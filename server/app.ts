import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import type { Pool } from 'pg';
import { pinoHttp } from 'pino-http';
import type { AppEnv } from './config/env.js';
import { errorHandler, notFoundHandler } from './http/errors.js';
import { loadSession, originGuard } from './middleware/auth.js';
import { generalLimit } from './middleware/limits.js';
import { adminRoutes } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { orderRoutes } from './routes/orders.js';
import { paymentSettingsRoutes } from './routes/payment-settings.js';
import { productRoutes } from './routes/products.js';
import { PostgresAdminService } from './services/admin-service.js';
import { PostgresAuthService } from './services/auth-service.js';
import type { Services } from './services/contracts.js';
import { WebhookEmailSender } from './services/email.js';
import { PostgresOrderService } from './services/order-service.js';
import { PostgresProductService } from './services/product-service.js';

export function createServices(pool: Pool, env: AppEnv): Services {
  return {
    auth: new PostgresAuthService(pool, env, new WebhookEmailSender(env)),
    products: new PostgresProductService(pool),
    orders: new PostgresOrderService(pool, env),
    admin: new PostgresAdminService(pool, env),
  };
}

export function createApp(env: AppEnv, services: Services) {
  const app = express();
  if (env.TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(pinoHttp({
    level: env.NODE_ENV === 'test' ? 'silent' : 'info',
    redact: ['req.headers.authorization', 'req.headers.cookie', 'req.headers.x-csrf-token', 'res.headers.set-cookie'],
    serializers: { req: (request: { id?: unknown; method?: string; url?: string }) => ({ id: request.id, method: request.method, url: request.url }) },
  }));

  app.use((request, response, next) => {
    if (env.NODE_ENV === 'production' && !request.secure) {
      if (!env.PUBLIC_API_URL) return response.status(400).json({ error: { code: 'HTTPS_REQUIRED', message: 'HTTPS es obligatorio.' } });
      const target = new URL(request.originalUrl, env.PUBLIC_API_URL);
      return response.redirect(308, target.toString());
    }
    next();
  });

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'none'"],
      },
    },
    hsts: env.NODE_ENV === 'production' ? { maxAge: 31_536_000, includeSubDomains: true } : false,
    referrerPolicy: { policy: 'no-referrer' },
  }));
  app.use((_request, response, next) => {
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
    response.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(cors({
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Idempotency-Key'],
    origin(origin, callback) {
      if (!origin || env.allowedOrigins.includes(origin)) return callback(null, true);
      callback(null, false);
    },
  }));
  app.use(compression());
  app.use(express.json({ limit: '100kb', strict: true }));
  app.use(cookieParser());
  app.use(originGuard(env));
  app.use(generalLimit);
  app.use(loadSession(services.auth, env));

  app.get('/health', (_request, response) => response.json({ status: 'ok' }));
  app.use('/api/auth', authRoutes(services.auth, env));
  app.use('/api/products', productRoutes(services.products));
  app.use('/api/orders', orderRoutes(services.orders));
  app.use('/api/payment-settings', paymentSettingsRoutes(services.admin));
  app.use('/api/admin', adminRoutes(services.admin));
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
