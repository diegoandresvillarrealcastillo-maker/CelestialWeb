import type { RequestHandler } from 'express';
import type { AppEnv } from '../config/env.js';
import { HttpError } from '../http/errors.js';

export const verifyTurnstile = (env: AppEnv): RequestHandler => async (request, _response, next) => {
  if (!env.TURNSTILE_SECRET_KEY) return next();
  const token = typeof (request.body as { turnstileToken?: unknown })?.turnstileToken === 'string'
    ? (request.body as { turnstileToken: string }).turnstileToken
    : '';
  if (!token) return next(new HttpError(422, 'Verificación de seguridad requerida.', 'TURNSTILE_REQUIRED'));

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token, remoteip: request.ip }),
      signal: AbortSignal.timeout(8_000),
    });
    const result = await response.json() as { success: boolean };
    if (!result.success) return next(new HttpError(403, 'No fue posible verificar que eres una persona.', 'TURNSTILE_FAILED'));
    next();
  } catch {
    next(new HttpError(503, 'No fue posible completar la verificación de seguridad. Intenta de nuevo.', 'TURNSTILE_UNAVAILABLE'));
  }
};
