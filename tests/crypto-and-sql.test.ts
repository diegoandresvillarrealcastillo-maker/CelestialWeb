import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import { hashPassword, verifyPassword } from '../server/security/passwords.js';
import { PostgresProductService } from '../server/services/product-service.js';

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
