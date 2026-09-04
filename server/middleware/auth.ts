import type { RequestHandler } from 'express';
import type { AppEnv } from '../config/env.js';
import { HttpError } from '../http/errors.js';
import { safeTokenMatch } from '../security/tokens.js';
import type { AuthService } from '../services/contracts.js';

export const loadSession = (service: AuthService, env: AppEnv): RequestHandler => async (request, _response, next) => {
  try {
    const rawToken = request.cookies?.[env.SESSION_COOKIE_NAME];
    if (typeof rawToken === 'string') request.auth = await service.getSession(rawToken) ?? undefined;
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAuth: RequestHandler = (request, _response, next) => {
  if (!request.auth) return next(new HttpError(401, 'Debes iniciar sesión.', 'AUTH_REQUIRED'));
  next();
};

export const requireRole = (role: string): RequestHandler => (request, _response, next) => {
  if (!request.auth) return next(new HttpError(401, 'Debes iniciar sesión.', 'AUTH_REQUIRED'));
  if (!request.auth.roles.includes(role)) return next(new HttpError(403, 'No tienes permiso para realizar esta acción.', 'FORBIDDEN'));
  next();
};

export const requireCsrf: RequestHandler = (request, _response, next) => {
  const token = request.get('x-csrf-token');
  if (!request.auth || !token || !safeTokenMatch(token, request.auth.csrfHash)) {
    return next(new HttpError(403, 'La solicitud de seguridad no es válida.', 'CSRF_INVALID'));
  }
  next();
};

export const requireCsrfIfAuthenticated: RequestHandler = (request, response, next) => {
  if (!request.auth) return next();
  return requireCsrf(request, response, next);
};

export const originGuard = (env: AppEnv): RequestHandler => (request, _response, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next();
  const origin = request.get('origin');
  if (!origin && env.NODE_ENV !== 'production') return next();
  if (!origin || !env.allowedOrigins.includes(origin)) {
    return next(new HttpError(403, 'Origen no autorizado.', 'ORIGIN_FORBIDDEN'));
  }
  next();
};
