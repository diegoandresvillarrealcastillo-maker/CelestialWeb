import { randomUUID } from 'node:crypto';
import type { AppEnv } from '../config/env.js';
import { HttpError } from '../http/errors.js';

const BUCKET = 'product-images';

function assertConfigured(env: AppEnv): asserts env is AppEnv & { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string } {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new HttpError(503, 'El almacenamiento de imágenes no está configurado.', 'STORAGE_NOT_CONFIGURED');
  }
}

async function ensureBucket(env: AppEnv & { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string }) {
  await fetch(`${env.SUPABASE_URL}/storage/v1/bucket`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  });
}

export async function uploadProductImage(env: AppEnv, file: { buffer: Buffer; mimetype: string; originalname: string }): Promise<string> {
  assertConfigured(env);
  const extension = file.originalname.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'webp';
  const path = `products/${randomUUID()}.${extension}`;
  const upload = async () => fetch(`${env.SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      'content-type': file.mimetype,
    },
    body: new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }),
  });

  let response = await upload();
  if (response.status === 404 || (response.status === 400 && (await response.clone().text()).includes('not found'))) {
    await ensureBucket(env);
    response = await upload();
  }
  if (!response.ok) {
    throw new HttpError(502, 'No fue posible subir la imagen.', 'UPLOAD_FAILED');
  }
  return `${env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}
