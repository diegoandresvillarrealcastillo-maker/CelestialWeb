import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { loadEnv } from '../server/config/env.js';
import { createPool } from '../server/database/pool.js';
import { hashToken } from '../server/security/tokens.js';

const env = loadEnv();
const databaseName = `celestial_audit_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 8)}`;
if (!/^celestial_audit_[0-9]+_[0-9a-f]{8}$/.test(databaseName)) throw new Error('Unsafe temporary database name.');

const targetUrl = new URL(env.DATABASE_URL);
targetUrl.pathname = `/${databaseName}`;
const targetDatabaseUrl = targetUrl.toString();
const adminPool = createPool(env, { statement: 0, query: 0 });

async function runScript(script: 'scripts/migrate.ts' | 'scripts/seed.ts') {
  const child = spawn(process.execPath, ['--import', 'tsx', script], {
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'development', DATABASE_URL: targetDatabaseUrl, DATABASE_SSL: String(env.DATABASE_SSL) },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let stderr = '';
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => { stderr += chunk; });
  const [code] = await once(child, 'exit') as [number | null];
  if (code !== 0) throw new Error(`${script} failed: ${stderr.slice(-1_000)}`);
}

try {
  await adminPool.query(`CREATE DATABASE "${databaseName}"`);
  await Promise.all([runScript('scripts/migrate.ts'), runScript('scripts/migrate.ts')]);
  await runScript('scripts/migrate.ts');
  await runScript('scripts/seed.ts');
  await runScript('scripts/seed.ts');

  const auditPool = createPool({ ...env, DATABASE_URL: targetDatabaseUrl }, { statement: 0, query: 0 });
  try {
    const counts = await auditPool.query<{ migrations: number; products: number; images: number; links: number; quote_only: number; active_promotions: number }>(
      `SELECT
        (SELECT count(*)::int FROM schema_migrations) AS migrations,
        (SELECT count(*)::int FROM products) AS products,
        (SELECT count(*)::int FROM product_images) AS images,
        (SELECT count(*)::int FROM product_categories) AS links,
        (SELECT count(*)::int FROM products WHERE requires_consultation) AS quote_only,
        (SELECT count(*)::int FROM promotions WHERE active) AS active_promotions`,
    );
    const actual = counts.rows[0];
    if (!actual || actual.migrations !== 14 || actual.products !== 22 || actual.images !== 24
      || actual.links !== 22 || actual.quote_only !== 7 || actual.active_promotions !== 0) {
      throw new Error(`Unexpected clean database counts: ${JSON.stringify(actual)}`);
    }

    const client = await auditPool.connect();
    try {
      const product = await client.query<{ id: string; name: string; price_cop: number }>(
        'SELECT id, name, price_cop FROM products WHERE active AND NOT requires_consultation ORDER BY created_at LIMIT 1',
      );
      const chosen = product.rows[0];
      if (!chosen) throw new Error('No checkout product available for RLS verification.');
      const orderA = randomUUID();
      const orderB = randomUUID();
      const hashA = hashToken('audit-guest-token-a');
      const hashB = hashToken('audit-guest-token-b');
      await client.query('BEGIN');
      await client.query('SET LOCAL ROLE celestial_app');

      await client.query("SELECT set_config('app.guest_email', $1, true), set_config('app.guest_order_hash', $2, true)", ['audit-a@example.invalid', hashA]);
      await client.query(
        `INSERT INTO orders (id, user_id, guest_email, guest_token_hash, subtotal_cop, discount_cop, shipping_cop, total_cop, shipping_address)
         VALUES ($1, NULL, $2, $3, $4, 0, 0, $4, $5::jsonb)`,
        [orderA, 'audit-a@example.invalid', hashA, chosen.price_cop, JSON.stringify({ fullName: 'Audit A', phone: '3000000000', address: 'Audit 1', city: 'Bogotá' })],
      );
      await client.query("SELECT set_config('app.guest_order_id', $1, true)", [orderA]);
      await client.query(
        `INSERT INTO order_items (order_id, product_id, product_name, unit_price_cop, quantity, selected_options)
         VALUES ($1, $2, $3, $4, 1, '{}'::jsonb)`, [orderA, chosen.id, chosen.name, chosen.price_cop],
      );

      await client.query("SELECT set_config('app.guest_email', $1, true), set_config('app.guest_order_hash', $2, true)", ['audit-b@example.invalid', hashB]);
      await client.query(
        `INSERT INTO orders (id, user_id, guest_email, guest_token_hash, subtotal_cop, discount_cop, shipping_cop, total_cop, shipping_address)
         VALUES ($1, NULL, $2, $3, $4, 0, 0, $4, $5::jsonb)`,
        [orderB, 'audit-b@example.invalid', hashB, chosen.price_cop, JSON.stringify({ fullName: 'Audit B', phone: '3000000001', address: 'Audit 2', city: 'Bogotá' })],
      );

      await client.query('SAVEPOINT cross_guest');
      let crossGuestBlocked = false;
      try {
        await client.query("SELECT set_config('app.guest_order_hash', $1, true), set_config('app.guest_order_id', $2, true)", [hashA, orderB]);
        await client.query(
          `INSERT INTO order_items (order_id, product_id, product_name, unit_price_cop, quantity, selected_options)
           VALUES ($1, $2, $3, $4, 1, '{}'::jsonb)`, [orderB, chosen.id, chosen.name, chosen.price_cop],
        );
      } catch (error) {
        crossGuestBlocked = (error as { code?: string }).code === '42501';
        await client.query('ROLLBACK TO SAVEPOINT cross_guest');
      }
      if (!crossGuestBlocked) throw new Error('Cross-guest order item insertion was not blocked.');

      await client.query('SAVEPOINT raw_secret');
      let rawSecretBlocked = false;
      try {
        const keyHash = hashToken('audit-idempotency-key');
        await client.query("SELECT set_config('app.idempotency_hash', $1, true)", [keyHash]);
        await client.query(
          `INSERT INTO idempotency_keys (key_hash, scope, response_body, expires_at)
           VALUES ($1, 'create-order', '{"guestToken":"must-not-persist"}'::jsonb, now() + interval '1 hour')`, [keyHash],
        );
      } catch (error) {
        rawSecretBlocked = (error as { code?: string }).code === '23514';
        await client.query('ROLLBACK TO SAVEPOINT raw_secret');
      }
      if (!rawSecretBlocked) throw new Error('Idempotency response accepted a raw guest token.');

      await client.query('SAVEPOINT free_price');
      let freePriceBlocked = false;
      try {
        await client.query("SELECT set_config('app.user_role', 'admin', true)");
        await client.query('UPDATE products SET price_cop = 0 WHERE id = $1', [chosen.id]);
      } catch (error) {
        freePriceBlocked = (error as { code?: string }).code === '23514';
        await client.query('ROLLBACK TO SAVEPOINT free_price');
      }
      if (!freePriceBlocked) throw new Error('A zero product price was not blocked.');
      await client.query('ROLLBACK');
    } finally {
      client.release();
    }
    console.log(`Database verification passed: ${actual.migrations} migrations, ${actual.products} products, RLS isolation and constraints OK.`);
  } finally {
    await auditPool.end();
  }
} finally {
  await adminPool.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()', [databaseName]);
  await adminPool.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
  await adminPool.end();
}
