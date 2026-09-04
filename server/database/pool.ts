import { Pool, type PoolClient } from 'pg';
import type { AppEnv } from '../config/env.js';
import type { AuthContext } from '../types.js';

export function createPool(env: AppEnv) {
  return new Pool({
    connectionString: env.DATABASE_URL,
    max: 12,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
    ssl: env.DATABASE_SSL
      ? { rejectUnauthorized: true, ...(env.DATABASE_CA_CERT ? { ca: env.DATABASE_CA_CERT } : {}) }
      : undefined,
    application_name: 'celestial-api',
  });
}

export async function inTransaction<T>(pool: Pool, callback: (client: PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function setDbContext(client: PoolClient, auth: AuthContext) {
  const role = auth.roles.includes('admin') ? 'admin' : auth.roles[0] ?? 'customer';
  await client.query("SELECT set_config('app.user_id', $1, true), set_config('app.user_role', $2, true)", [auth.userId, role]);
}

export async function withAuthContext<T>(pool: Pool, auth: AuthContext, callback: (client: PoolClient) => Promise<T>) {
  return inTransaction(pool, async (client) => {
    await setDbContext(client, auth);
    return callback(client);
  });
}
