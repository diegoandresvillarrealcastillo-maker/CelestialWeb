import { z } from 'zod';
import { loadEnv } from '../server/config/env.js';
import { createPool, inTransaction } from '../server/database/pool.js';
import { hashPassword } from '../server/security/passwords.js';

const inputSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  fullName: z.string().trim().min(2).max(120),
  password: z.string().min(12).max(128)
    .regex(/[a-záéíóúñ]/i).regex(/[A-ZÁÉÍÓÚÑ]/).regex(/[0-9]/).regex(/[^\p{L}\p{N}\s]/u),
});

const input = inputSchema.parse({
  email: process.env.ADMIN_EMAIL,
  fullName: process.env.ADMIN_FULL_NAME,
  password: process.env.ADMIN_PASSWORD,
});
const env = loadEnv();
const pool = createPool(env);

try {
  const passwordHash = await hashPassword(input.password);
  await inTransaction(pool, async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('celestial-admin-provision'))");
    const existing = await client.query<{ id: string }>('SELECT id FROM users WHERE email = $1 LIMIT 1', [input.email]);
    const existingId = existing.rows[0]?.id;
    const otherAdminCount = await client.query<{ count: number }>(
      `SELECT count(DISTINCT u.id)::int AS count
         FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
        WHERE r.name = 'admin' AND u.status = 'active' AND u.password_hash IS NOT NULL
          AND ($1::uuid IS NULL OR u.id <> $1::uuid)`,
      [existingId ?? null],
    );
    if ((otherAdminCount.rows[0]?.count ?? 0) >= env.EXPECTED_ADMIN_COUNT) {
      throw new Error(`The configured limit of ${env.EXPECTED_ADMIN_COUNT} administrators has already been reached.`);
    }

    const user = existingId
      ? await client.query<{ id: string }>(
        `UPDATE users SET password_hash = $2, status = 'active', email_verified_at = COALESCE(email_verified_at, now())
          WHERE id = $1 RETURNING id`, [existingId, passwordHash],
      )
      : await client.query<{ id: string }>(
        `INSERT INTO users (email, password_hash, email_verified_at) VALUES ($1, $2, now()) RETURNING id`,
        [input.email, passwordHash],
      );
    const userId = user.rows[0].id;
    await client.query(
      `INSERT INTO profiles (user_id, full_name) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET full_name = EXCLUDED.full_name`, [userId, input.fullName],
    );
    await client.query('DELETE FROM user_roles WHERE user_id = $1', [userId]);
    await client.query(
      `INSERT INTO user_roles (user_id, role_id) SELECT $1, id FROM roles WHERE name = 'admin'`, [userId],
    );
    await client.query('UPDATE sessions SET invalidated_at = now() WHERE user_id = $1 AND invalidated_at IS NULL', [userId]);
  });
  console.log(`Administrator provisioned: ${input.email}`);
} finally {
  await pool.end();
}
