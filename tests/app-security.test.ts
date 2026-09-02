import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../server/app.js';
import type { AppEnv } from '../server/config/env.js';
import { HttpError } from '../server/http/errors.js';
import { hashToken } from '../server/security/tokens.js';
import type { AuthContext } from '../server/types.js';
import type { Services } from '../server/services/contracts.js';

const customer: AuthContext = { userId: '11111111-1111-4111-8111-111111111111', sessionId: 's1', sessionHash: hashToken('customer-token'), csrfHash: hashToken('csrf-good'), email: 'cliente@example.com', roles: ['customer'], fullName: 'Cliente', emailVerified: true };
const other: AuthContext = { ...customer, userId: '22222222-2222-4222-8222-222222222222', sessionId: 's2', email: 'otro@example.com' };
const admin: AuthContext = { ...customer, userId: '33333333-3333-4333-8333-333333333333', sessionId: 's3', roles: ['admin'], email: 'admin@example.com' };
const env: AppEnv = { NODE_ENV: 'test', PORT: 4000, DATABASE_URL: 'postgres://unused', DATABASE_SSL: false, WEB_ORIGIN: 'http://localhost:3000', PUBLIC_API_URL: 'http://localhost:4000', TRUST_PROXY: false, SESSION_COOKIE_NAME: 'celestial_session', SESSION_TTL_HOURS: 24, IP_HASH_SECRET: 'x'.repeat(32), allowedOrigins: ['http://localhost:3000'] };

function services(): Services {
  return {
    auth: {
      getSession: vi.fn(async (token) => token === 'customer-token' ? customer : token === 'other-token' ? other : token === 'admin-token' ? admin : null),
      register: vi.fn(async () => undefined),
      login: vi.fn(async ({ email, password }) => {
        if (email !== 'cliente@example.com' || password !== 'Valid-password-123!') throw new HttpError(401, 'Credenciales inválidas.', 'INVALID_CREDENTIALS');
        return { token: 'new-session-token', csrfToken: 'csrf-new', user: customer };
      }),
      logout: vi.fn(async () => undefined), rotateCsrf: vi.fn(async () => 'csrf-rotated'),
      forgotPassword: vi.fn(async () => undefined), resetPassword: vi.fn(async () => undefined), verifyEmail: vi.fn(async () => undefined),
      updateProfile: vi.fn(async (auth) => auth), changePassword: vi.fn(async () => undefined),
    },
    products: { list: vi.fn(async () => []), getBySlug: vi.fn(async () => null) },
    orders: {
      create: vi.fn(async (_auth, input) => ({ orderNumber: '1001', totalCop: (input as { serverTotal?: number }).serverTotal ?? 40000 })),
      list: vi.fn(async () => []),
      get: vi.fn(async (auth, id) => auth.userId === customer.userId && id === 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' ? { id } : null),
    },
    admin: {
      getOverview: vi.fn(async () => ({ activeProducts: 22 })), listOrders: vi.fn(async () => []),
      updateOrder: vi.fn(async () => ({})), updateProduct: vi.fn(async () => ({})), createProduct: vi.fn(async () => ({})), deactivateProduct: vi.fn(async () => undefined),
      listCategories: vi.fn(async () => []), createCategory: vi.fn(async () => ({})), updateCategory: vi.fn(async () => ({})),
      listPromotions: vi.fn(async () => []), createPromotion: vi.fn(async () => ({})), updatePromotion: vi.fn(async () => ({})),
    },
  };
}

describe('API security boundaries', () => {
  let fake: Services;
  beforeEach(() => { fake = services(); });

  it('sets an opaque HttpOnly SameSite session cookie after login', async () => {
    const response = await request(createApp(env, fake)).post('/api/auth/login').send({ email: 'cliente@example.com', password: 'Valid-password-123!' });
    expect(response.status).toBe(200);
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.headers['set-cookie'][0]).toContain('SameSite=Lax');
    expect(response.body.csrfToken).toBe('csrf-new');
  });

  it('uses a generic login error', async () => {
    const response = await request(createApp(env, fake)).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'wrong' });
    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('Credenciales inválidas.');
  });

  it('requires valid CSRF for a cookie-authenticated write', async () => {
    const response = await request(createApp(env, fake)).post('/api/auth/logout').set('Cookie', 'celestial_session=customer-token');
    expect(response.status).toBe(403);
    expect(fake.auth.logout).not.toHaveBeenCalled();
  });

  it('denies a customer access to administrative endpoints', async () => {
    const response = await request(createApp(env, fake)).get('/api/admin/overview').set('Cookie', 'celestial_session=customer-token');
    expect(response.status).toBe(403);
  });

  it('allows an administrator validated by the server', async () => {
    const response = await request(createApp(env, fake)).get('/api/admin/overview').set('Cookie', 'celestial_session=admin-token');
    expect(response.status).toBe(200);
  });

  it('denies horizontal order access between users', async () => {
    const response = await request(createApp(env, fake)).get('/api/orders/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa').set('Cookie', 'celestial_session=other-token');
    expect(response.status).toBe(404);
  });

  it('rejects totals and prices supplied by the browser', async () => {
    const response = await request(createApp(env, fake)).post('/api/orders')
      .set('Cookie', 'celestial_session=customer-token').set('X-CSRF-Token', 'csrf-good')
      .send({ items: [{ productId: 'aromatica-300', quantity: 1, selectedOptions: {} }], shippingAddress: { fullName: 'Cliente Uno', phone: '3001234567', address: 'Calle 1 # 2-3', city: 'Bogotá' }, total: 1, price: 1 });
    expect(response.status).toBe(422);
    expect(fake.orders.create).not.toHaveBeenCalled();
  });

  it('rejects mass assignment fields in an admin product update', async () => {
    const response = await request(createApp(env, fake)).patch('/api/admin/products/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
      .set('Cookie', 'celestial_session=admin-token').set('X-CSRF-Token', 'csrf-good').send({ priceCop: 10000, role: 'admin' });
    expect(response.status).toBe(422);
    expect(fake.admin.updateProduct).not.toHaveBeenCalled();
  });
});

describe('login throttling', () => {
  it('returns 429 after repeated login attempts', async () => {
    const app = createApp(env, services());
    let response;
    for (let attempt = 0; attempt < 11; attempt += 1) response = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'wrong' });
    expect(response!.status).toBe(429);
  });
});
