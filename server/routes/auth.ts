import { Router } from 'express';
import type { AppEnv } from '../config/env.js';
import { requireAuth, requireCsrf } from '../middleware/auth.js';
import { loginLimit, recoveryLimit, registerLimit } from '../middleware/limits.js';
import { verifyTurnstile } from '../middleware/turnstile.js';
import type { AuthService } from '../services/contracts.js';
import {
  changePasswordSchema, forgotPasswordSchema, googleAuthSchema, loginSchema, profileSchema,
  registerSchema, resetPasswordSchema, verifyEmailSchema,
} from '../validators/schemas.js';

const meta = (request: { ip?: string; get(name: string): string | undefined }) => ({
  ip: request.ip ?? 'unknown', userAgent: request.get('user-agent'),
});

export function authRoutes(service: AuthService, env: AppEnv) {
  const router = Router();
  const cookieOptions = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: env.SESSION_TTL_HOURS * 60 * 60 * 1000,
  };

  router.post('/register', registerLimit, verifyTurnstile(env), async (request, response) => {
    const input = registerSchema.parse(request.body);
    await service.register(input, meta(request));
    response.status(201).json({ message: 'Si la dirección es válida, recibirás instrucciones para verificarla.' });
  });

  router.post('/login', loginLimit, async (request, response) => {
    const input = loginSchema.parse(request.body);
    const result = await service.login(input, meta(request));
    response.cookie(env.SESSION_COOKIE_NAME, result.token, cookieOptions);
    response.json({ user: result.user, csrfToken: result.csrfToken });
  });

  router.post('/google', loginLimit, async (request, response) => {
    const input = googleAuthSchema.parse(request.body);
    const result = await service.loginWithGoogle(input.idToken, meta(request));
    response.cookie(env.SESSION_COOKIE_NAME, result.token, cookieOptions);
    response.json({ user: result.user, csrfToken: result.csrfToken });
  });

  router.get('/me', requireAuth, (request, response) => {
    const { userId, email, roles, fullName, emailVerified } = request.auth!;
    response.json({ user: { userId, email, roles, fullName, emailVerified } });
  });

  router.get('/csrf', requireAuth, async (request, response) => {
    const csrfToken = await service.rotateCsrf(request.auth!);
    response.set('Cache-Control', 'no-store').json({ csrfToken });
  });

  router.post('/logout', requireAuth, requireCsrf, async (request, response) => {
    await service.logout(request.auth!);
    response.clearCookie(env.SESSION_COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
    response.status(204).end();
  });

  router.post('/forgot-password', recoveryLimit, async (request, response) => {
    const input = forgotPasswordSchema.parse(request.body);
    await service.forgotPassword(input.email, meta(request));
    response.status(202).json({ message: 'Si la cuenta existe, recibirás instrucciones para continuar.' });
  });

  router.post('/reset-password', recoveryLimit, async (request, response) => {
    const input = resetPasswordSchema.parse(request.body);
    await service.resetPassword(input.token, input.password);
    response.json({ message: 'Contraseña actualizada. Inicia sesión nuevamente.' });
  });

  router.post('/verify-email', recoveryLimit, async (request, response) => {
    const input = verifyEmailSchema.parse(request.body);
    await service.verifyEmail(input.token);
    response.json({ message: 'Correo verificado correctamente.' });
  });

  router.patch('/profile', requireAuth, requireCsrf, async (request, response) => {
    const input = profileSchema.parse(request.body);
    const auth = await service.updateProfile(request.auth!, input);
    const { userId, email, roles, fullName, emailVerified } = auth;
    response.json({ user: { userId, email, roles, fullName, emailVerified } });
  });

  router.post('/change-password', loginLimit, requireAuth, requireCsrf, async (request, response) => {
    const input = changePasswordSchema.parse(request.body);
    await service.changePassword(request.auth!, input.currentPassword, input.newPassword);
    response.clearCookie(env.SESSION_COOKIE_NAME, { ...cookieOptions, maxAge: undefined });
    response.json({ message: 'Contraseña actualizada. Todas las sesiones fueron cerradas.' });
  });

  return router;
}
