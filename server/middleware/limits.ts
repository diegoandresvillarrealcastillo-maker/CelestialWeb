import { rateLimit } from 'express-rate-limit';

const response = { error: { code: 'RATE_LIMITED', message: 'Demasiadas solicitudes. Intenta de nuevo más tarde.' } };

const limit = (windowMs: number, max: number) => rateLimit({
  windowMs, limit: max, standardHeaders: 'draft-8', legacyHeaders: false, message: response,
});

export const generalLimit = limit(15 * 60_000, 250);
export const loginLimit = limit(15 * 60_000, 10);
export const registerLimit = limit(60 * 60_000, 5);
export const recoveryLimit = limit(60 * 60_000, 5);
export const searchLimit = limit(60_000, 60);
export const orderLimit = limit(60 * 60_000, 20);
export const adminLimit = limit(15 * 60_000, 120);
