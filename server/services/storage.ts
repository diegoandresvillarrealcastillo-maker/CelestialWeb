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
  await fetch(`${env.SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ id: bucket, name: bucket, public: isPublic }),
  });
}

async function uploadFile(env: AppEnv, bucket: string, isPublic: boolean, pathPrefix: string, file: UploadFile): Promise<string> {
  assertConfigured(env);
  const extension = file.originalname.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const path = `${pathPrefix}${randomUUID()}.${extension}`;
  const upload = async () => fetch(`${env.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: env.SUPABASE_SERVICE_ROLE_KEY, 'content-type': file.mimetype },
    body: new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }),
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
