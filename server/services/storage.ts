import { randomUUID } from 'node:crypto';
import type { AppEnv } from '../config/env.js';
import { HttpError } from '../http/errors.js';

type UploadFile = { buffer: Buffer; mimetype: string; originalname: string };
type ConfiguredEnv = AppEnv & { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string };

function assertConfigured(env: AppEnv): asserts env is ConfiguredEnv {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new HttpError(503, 'El almacenamiento de archivos no está configurado.', 'STORAGE_NOT_CONFIGURED');
  }
}

async function ensureBucket(env: ConfiguredEnv, bucket: string, isPublic: boolean) {
  const response = await fetch(`${env.SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ id: bucket, name: bucket, public: isPublic }),
  });
  if (!response.ok && response.status !== 409) throw new HttpError(502, 'No fue posible preparar el almacenamiento.', 'STORAGE_SETUP_FAILED');
}

const imageTypes = {
  'image/jpeg': { extension: 'jpg', matches: (buffer: Buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff },
  'image/png': { extension: 'png', matches: (buffer: Buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/webp': { extension: 'webp', matches: (buffer: Buffer) => buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP' },
} as const;

export function detectImageMime(buffer: Buffer): keyof typeof imageTypes | null {
  const found = Object.entries(imageTypes).find(([, signature]) => signature.matches(buffer));
  return found?.[0] as keyof typeof imageTypes | undefined ?? null;
}

async function uploadFile(env: AppEnv, bucket: string, isPublic: boolean, pathPrefix: string, file: UploadFile): Promise<string> {
  const detectedType = detectImageMime(file.buffer);
  if (!detectedType || detectedType !== file.mimetype.toLowerCase()) {
    throw new HttpError(400, 'El contenido del archivo no coincide con una imagen JPEG, PNG o WebP válida.', 'INVALID_FILE_CONTENT');
  }
  assertConfigured(env);
  const extension = imageTypes[detectedType].extension;
  const path = `${pathPrefix}${randomUUID()}.${extension}`;
  const upload = async () => fetch(`${env.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY, 'content-type': detectedType, 'x-upsert': 'false' },
    body: new Blob([new Uint8Array(file.buffer)], { type: detectedType }),
  });

  let response = await upload();
  if (response.status === 404 || (response.status === 400 && (await response.clone().text()).includes('not found'))) {
    await ensureBucket(env, bucket, isPublic);
    response = await upload();
  }
  if (!response.ok) throw new HttpError(502, 'No fue posible subir el archivo.', 'UPLOAD_FAILED');
  return path;
}

export async function uploadProductImage(env: AppEnv, file: UploadFile): Promise<string> {
  assertConfigured(env);
  const path = await uploadFile(env, 'product-images', true, 'products/', file);
  return `${env.SUPABASE_URL}/storage/v1/object/public/product-images/${path}`;
}

export async function uploadPaymentReceipt(env: AppEnv, orderId: string, file: UploadFile): Promise<string> {
  return uploadFile(env, 'payment-receipts', false, `orders/${orderId}/`, file);
}

export async function getSignedReceiptUrl(env: AppEnv, receiptPath: string, expiresInSeconds = 300): Promise<string | null> {
  assertConfigured(env);
  const response = await fetch(`${env.SUPABASE_URL}/storage/v1/object/sign/payment-receipts/${receiptPath}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ expiresIn: expiresInSeconds }),
  });
  if (!response.ok) return null;
  const data = await response.json() as { signedURL?: string };
  return data.signedURL ? `${env.SUPABASE_URL}/storage/v1${data.signedURL}` : null;
}
