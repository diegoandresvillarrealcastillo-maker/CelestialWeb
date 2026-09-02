import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadEnv } from '../server/config/env.js';
import { createPool, inTransaction } from '../server/database/pool.js';

const env = loadEnv();
const pool = createPool(env);

try {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  const files = (await readdir(resolve('migrations'))).filter((file) => file.endsWith('.sql')).sort();
  for (const filename of files) {
    const found = await pool.query('SELECT 1 FROM schema_migrations WHERE filename = $1', [filename]);
    if (found.rowCount) continue;
    const sql = await readFile(resolve('migrations', filename), 'utf8');
    await inTransaction(pool, async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('celestial-migrations'))");
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
    });
    console.log(`Applied ${filename}`);
  }
} finally {
  await pool.end();
}
