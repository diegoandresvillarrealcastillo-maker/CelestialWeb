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
  ORDER_TOKEN_SECRET: z.string().min(32).optional(),
  EMAIL_PROVIDER_URL: z.string().url().optional(),
  EMAIL_PROVIDER_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().email().optional(),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  WHATSAPP_NUMBER: z.string().regex(/^\d{8,15}$/).default('573205279249'),
  HEALTHCHECK_SECRET: z.string().min(32).optional(),
  EXPECTED_ADMIN_COUNT: z.coerce.number().int().min(2).max(2).default(2),
});

type ParsedEnv = z.infer<typeof envSchema>;
export type AppEnv = Omit<ParsedEnv, 'ORDER_TOKEN_SECRET'> & { ORDER_TOKEN_SECRET: string; allowedOrigins: string[] };

export function loadEnv(source: NodeJS.ProcessEnv = process.env): AppEnv {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
    throw new Error(`Invalid or missing environment variables: ${names}`);
  }
  const allowedOrigins = parsed.data.WEB_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean);
  try {
    for (const origin of allowedOrigins) {
      const parsedOrigin = new URL(origin);
      if (parsedOrigin.origin !== origin || (parsed.data.NODE_ENV === 'production' && parsedOrigin.protocol !== 'https:')) throw new Error();
    }
  } catch {
    throw new Error('Invalid or missing environment variables: WEB_ORIGIN');
  }
  if (parsed.data.NODE_ENV === 'production') {
    if (!parsed.data.PUBLIC_API_URL?.startsWith('https://')) throw new Error('Invalid or missing environment variables: PUBLIC_API_URL');
    if (!parsed.data.HEALTHCHECK_SECRET) throw new Error('Invalid or missing environment variables: HEALTHCHECK_SECRET');
    if (!parsed.data.ORDER_TOKEN_SECRET) throw new Error('Invalid or missing environment variables: ORDER_TOKEN_SECRET');
    if (!parsed.data.DATABASE_SSL) throw new Error('Invalid or missing environment variables: DATABASE_SSL');
    if (!parsed.data.SUPABASE_URL || !parsed.data.SUPABASE_SERVICE_ROLE_KEY) throw new Error('Invalid or missing environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    if (!parsed.data.EMAIL_PROVIDER_URL || !parsed.data.EMAIL_PROVIDER_API_KEY || !parsed.data.EMAIL_FROM) throw new Error('Invalid or missing environment variables: EMAIL_PROVIDER_URL, EMAIL_PROVIDER_API_KEY, EMAIL_FROM');
  }
  return {
    ...parsed.data,
    ORDER_TOKEN_SECRET: parsed.data.ORDER_TOKEN_SECRET ?? parsed.data.IP_HASH_SECRET,
    allowedOrigins,
  };
}
