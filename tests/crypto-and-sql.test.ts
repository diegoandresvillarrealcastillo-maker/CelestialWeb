import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { hashPassword, verifyPassword } from '../server/security/passwords.js';
import { PostgresOrderService } from '../server/services/order-service.js';
import { PostgresProductService } from '../server/services/product-service.js';
import { hashIdentifier, hashToken, safeTokenMatch } from '../server/security/tokens.js';
import { detectImageMime } from '../server/services/storage.js';

function fakeGuestOrderPool(order: { payment_status: string; guest_token_hash: string | null } | undefined) {
  const client = {
    query: vi.fn(async (sql: string) => {
      if (/^SELECT id, payment_status/.test(sql.trim())) return { rows: order ? [{ id: 'order-1', ...order }] : [] };
      return { rows: [] };
    }),
    release: vi.fn(),
  };
  return { connect: vi.fn(async () => client) } as never;
}

describe('token matching', () => {
  it('accepts a raw token that matches its own hash', () => {
    const raw = 'session-token-abc123';
    expect(safeTokenMatch(raw, hashToken(raw))).toBe(true);
  });

  it('rejects a raw token that does not match the expected hash', () => {
    expect(safeTokenMatch('wrong-token', hashToken('session-token-abc123'))).toBe(false);
  });

  it('rejects a hash of a different length instead of throwing', () => {
    expect(safeTokenMatch('session-token-abc123', 'not-a-valid-hash')).toBe(false);
  });
});

describe('identifier hashing', () => {
  it('is deterministic for the same value and secret', () => {
    expect(hashIdentifier('user@example.com', 'secret-1')).toBe(hashIdentifier('user@example.com', 'secret-1'));
  });

  it('produces a different digest for a different secret', () => {
    expect(hashIdentifier('user@example.com', 'secret-1')).not.toBe(hashIdentifier('user@example.com', 'secret-2'));
  });
});

describe('credential storage', () => {
  it('hashes passwords with Argon2id and verifies them', async () => {
    const password = 'Valid-password-123!';
    const hash = await hashPassword(password);
    expect(hash).not.toContain(password);
    expect(hash.startsWith('$argon2id$')).toBe(true);
    await expect(verifyPassword(hash, password)).resolves.toBe(true);
    await expect(verifyPassword(hash, 'incorrect')).resolves.toBe(false);
  });
});

describe('uploaded image signatures', () => {
  it('detects supported image bytes instead of trusting a declared MIME type', () => {
    expect(detectImageMime(Buffer.from([0xff, 0xd8, 0xff, 0x00]))).toBe('image/jpeg');
    expect(detectImageMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png');
    expect(detectImageMime(Buffer.from('not-an-image'))).toBeNull();
  });
});

describe('parameterized catalog search', () => {
  it('keeps untrusted search input out of SQL text', async () => {
    const calls: unknown[][] = [];
    const query = vi.fn(async (...args: unknown[]) => { calls.push(args); return { rows: [] }; });
    const service = new PostgresProductService({ query } as never);
    const attack = "' OR 1=1 --";
    await service.list({ search: attack, sort: 'popular', limit: 20 });
    const [sql, values] = calls[0] as [string, unknown[]];
    expect(sql).not.toContain(attack);
    expect(values).toContain(`%${attack}%`);
  });
});

describe('guest order receipt authorization', () => {
  const rawToken = 'guest-order-secret-token';
  const service = () => new PostgresOrderService(fakeGuestOrderPool({ payment_status: 'pending', guest_token_hash: hashToken(rawToken) }), {} as never);
  const file = { buffer: Buffer.from('x'), mimetype: 'image/jpeg', originalname: 'r.jpg' };

  it('rejects a correct order id with the wrong token', async () => {
    await expect(service().attachReceipt(null, 'order-1', file, 'not-the-token'))
      .rejects.toMatchObject({ status: 403, code: 'ORDER_TOKEN_INVALID' });
  });

  it('rejects a request with no token at all', async () => {
    await expect(service().attachReceipt(null, 'order-1', file, undefined))
      .rejects.toMatchObject({ status: 403, code: 'ORDER_TOKEN_INVALID' });
  });

  it('rejects a valid-looking token for an order that has none stored (pre-migration orders)', async () => {
    const noTokenService = new PostgresOrderService(fakeGuestOrderPool({ payment_status: 'pending', guest_token_hash: null }), {} as never);
    await expect(noTokenService.attachReceipt(null, 'order-1', file, rawToken))
      .rejects.toMatchObject({ status: 403, code: 'ORDER_TOKEN_INVALID' });
  });

  it('rejects when the order id does not exist', async () => {
    const missingService = new PostgresOrderService(fakeGuestOrderPool(undefined), {} as never);
    await expect(missingService.attachReceipt(null, 'nope', file, rawToken))
      .rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });
});

describe('database defense in depth', () => {
  it('enables RLS and avoids unrestricted sensitive policies', async () => {
    const migration = await readFile(new URL('../migrations/001_initial.sql', import.meta.url), 'utf8');
    for (const table of ['users', 'profiles', 'orders', 'order_items', 'sessions', 'audit_logs']) {
      expect(migration).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
    }
    expect(migration).not.toMatch(/USING\s*\(\s*true\s*\)/i);
  });

  it('binds guest RLS and idempotency policies to per-request secrets', async () => {
    const migration = await readFile(new URL('../migrations/006_admin_only_and_guest_hardening.sql', import.meta.url), 'utf8');
    expect(migration).toContain("current_setting('app.guest_order_hash', true)");
    expect(migration).toContain("current_setting('app.idempotency_hash', true)");
    expect(migration).toContain('DROP POLICY IF EXISTS orders_guest_read');
    expect(migration).toContain('REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon');
  });

  it('binds guest order items to both the order id and its guest token', async () => {
    const migration = await readFile(new URL('../migrations/008_guest_item_binding_and_defaults.sql', import.meta.url), 'utf8');
    expect(migration).toContain("owner_order.guest_token_hash = NULLIF(current_setting('app.guest_order_hash', true), '')");
    expect(migration).toContain("order_id::text = NULLIF(current_setting('app.guest_order_id', true), '')");
    expect(migration).toContain('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
  });

  it('keeps quote-only products and unfinished promotions out of checkout totals', async () => {
    const migration = await readFile(new URL('../migrations/009_quote_only_products_and_promotion_safety.sql', import.meta.url), 'utf8');
    expect(migration).toContain('requires_consultation');
    expect(migration).toMatch(/CHECK\s*\(\s*active\s*=\s*false\s*\)/i);
    expect(migration).toContain('UPDATE promotions SET active = false');
  });

  it('prevents raw guest credentials from being cached in idempotency responses', async () => {
    const migration = await readFile(new URL('../migrations/010_idempotency_secret_sanitization.sql', import.meta.url), 'utf8');
    expect(migration).toContain("NOT (response_body ?| ARRAY['guestToken', 'whatsappUrl'])");
  });

  it('requires confirmed shipping before payment and positive product prices', async () => {
    const shipping = await readFile(new URL('../migrations/011_confirm_shipping_before_payment.sql', import.meta.url), 'utf8');
    const prices = await readFile(new URL('../migrations/012_positive_product_prices.sql', import.meta.url), 'utf8');
    expect(shipping).toContain('shipping_confirmed_at');
    expect(prices).toMatch(/CHECK\s*\(\s*price_cop\s+BETWEEN\s+1\s+AND\s+100000000\s*\)/i);
  });

  it('records guest privacy authorization at the database boundary', async () => {
    const migration = await readFile(new URL('../migrations/013_guest_privacy_consent.sql', import.meta.url), 'utf8');
    expect(migration).toContain('privacy_accepted_at');
    expect(migration).toMatch(/SET NOT NULL/i);
  });

  it('keeps real secrets out of the environment template', async () => {
    const example = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
    for (const line of example.split(/\r?\n/).filter(Boolean)) {
      const [, value = ''] = line.split('=', 2);
      expect(value).not.toMatch(/(?:sk-|eyJ|postgres:\/\/[^@]+@)/);
    }
  });
});
