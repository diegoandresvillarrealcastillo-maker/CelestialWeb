import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { hashPassword, verifyPassword } from '../server/security/passwords.js';
import { PostgresOrderService } from '../server/services/order-service.js';
import { PostgresProductService } from '../server/services/product-service.js';
import { hashIdentifier, hashToken, safeTokenMatch } from '../server/security/tokens.js';

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

  it('keeps real secrets out of the environment template', async () => {
    const example = await readFile(new URL('../.env.example', import.meta.url), 'utf8');
    for (const line of example.split(/\r?\n/).filter(Boolean)) {
      const [, value = ''] = line.split('=', 2);
      expect(value).not.toMatch(/(?:sk-|eyJ|postgres:\/\/[^@]+@)/);
    }
  });
});
