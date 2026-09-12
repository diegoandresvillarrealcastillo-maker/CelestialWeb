import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnv } from '../server/config/env.js';
import { createPool } from '../server/database/pool.js';

const env = loadEnv();
const pool = createPool(env, { statement: 0, query: 0 });
const client = await pool.connect();

try {
  // Serialize the complete migration discovery/apply sequence. Locking only
  // after the filename check lets two deploys both decide a migration is absent.
  await client.query('SET statement_timeout = 0');
  await client.query("SELECT pg_advisory_lock(hashtext('celestial-migrations'))");
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
    const files = (await readdir(resolve('migrations'))).filter((file) => file.endsWith('.sql')).sort();
    for (const filename of files) {
      await client.query('BEGIN');
      try {
        const found = await client.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [filename]);
        if (!found.rowCount) {
          const sql = await readFile(resolve('migrations', filename), 'utf8');
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
          console.log(`Applied ${filename}`);
        }
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    }
  } finally {
    await client.query("SELECT pg_advisory_unlock(hashtext('celestial-migrations'))");
  }
} finally {
  client.release();
  await pool.end();
}
