import type { Pool } from 'pg';
import type { AppEnv } from '../config/env.js';

const REQUIRED_MIGRATION = '014_fix_supabase_autorls_on_reference_tables.sql';

export async function assertProductionDatabaseSecurity(pool: Pool, env: AppEnv) {
  if (env.NODE_ENV !== 'production') return;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const identity = await client.query<{ rolsuper: boolean; rolbypassrls: boolean; owns_public_data_object: boolean }>(
      `SELECT r.rolsuper, r.rolbypassrls,
              EXISTS (
                SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                 WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'S') AND c.relowner = r.oid
              ) AS owns_public_data_object
         FROM pg_roles r WHERE r.rolname = current_user`,
    );
    const role = identity.rows[0];
    if (!role || role.rolsuper || role.rolbypassrls || role.owns_public_data_object) {
      throw new Error('DATABASE_URL must use a dedicated non-owner role without SUPERUSER or BYPASSRLS.');
    }

    const migrated = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [REQUIRED_MIGRATION]);
    if (!migrated.rowCount) throw new Error(`Required database migration is missing: ${REQUIRED_MIGRATION}`);

    await client.query("SELECT set_config('app.user_role', 'admin', true)");
    const counts = await client.query<{ valid_admins: number; total_users: number }>(
      `SELECT
        (SELECT count(DISTINCT u.id)::int
           FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
          WHERE r.name = 'admin' AND u.status = 'active' AND u.password_hash IS NOT NULL) AS valid_admins,
        (SELECT count(*)::int FROM users) AS total_users`,
    );
    if (counts.rows[0]?.valid_admins !== env.EXPECTED_ADMIN_COUNT || counts.rows[0]?.total_users !== env.EXPECTED_ADMIN_COUNT) {
      throw new Error(`Database identity policy requires exactly ${env.EXPECTED_ADMIN_COUNT} active password administrators and no other accounts.`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
