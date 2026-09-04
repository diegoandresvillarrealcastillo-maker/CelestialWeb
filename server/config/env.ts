import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1),
  DATABASE_SSL: booleanString.default(false),
  DATABASE_CA_CERT: z.string().optional(),
  WEB_ORIGIN: z.string().default('http://localhost:3000'),
  PUBLIC_API_URL: z.string().url().optional(),
  TRUST_PROXY: booleanString.default(false),
  SESSION_COOKIE_NAME: z.string().regex(/^[a-zA-Z0-9_-]+$/).default('celestial_session'),
  SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(24),
  IP_HASH_SECRET: z.string().min(32),
  EMAIL_PROVIDER_URL: z.string().url().optional(),
  EMAIL_PROVIDER_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().email().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().min(32).optional(),
  APP_ENCRYPTION_KEY: z.string().min(32).optional(),
  ADMIN_EMAILS: z.string().optional(),
  REQUIRE_EMAIL_VERIFICATION: booleanString.default(false),
  GOOGLE_CLIENT_ID: z.string().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
});

export type AppEnv = z.infer<typeof envSchema> & { allowedOrigins: string[]; adminEmails: string[] };

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid or missing environment variables: ${names}`);
  }
  return {
    ...parsed.data,
    allowedOrigins: parsed.data.WEB_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean),
    adminEmails: (parsed.data.ADMIN_EMAILS ?? '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean),
  };
}
