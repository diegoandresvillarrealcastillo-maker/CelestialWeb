import type { Pool, PoolClient } from 'pg';
import type { AppEnv } from '../config/env.js';
import { inTransaction, withAuthContext } from '../database/pool.js';
import { HttpError } from '../http/errors.js';
import { hashPassword, verifyPassword } from '../security/passwords.js';
import { hashIdentifier, hashToken, randomToken } from '../security/tokens.js';
import type { AuthContext, SessionResult } from '../types.js';
import type { AuthService, RequestMeta } from './contracts.js';
import type { EmailSender } from './email.js';

type LoginUser = {
  id: string;
  email: string;
  password_hash: string | null;
  status: string;
  email_verified_at: Date | null;
  failed_login_count: number;
  locked_until: Date | null;
  roles: string[];
};

const INVALID_CREDENTIALS = new HttpError(401, 'Credenciales inválidas.', 'INVALID_CREDENTIALS');

export class PostgresAuthService implements AuthService {
  constructor(private pool: Pool, private env: AppEnv, private email: EmailSender) {}

  private ipHash(meta: RequestMeta) {
    return hashIdentifier(meta.ip || 'unknown', this.env.IP_HASH_SECRET);
  }

  private async lookupUser(email: string): Promise<LoginUser | null> {
    return inTransaction(this.pool, async (client) => {
      await client.query("SELECT set_config('app.login_email', $1, true)", [email]);
      const result = await client.query<LoginUser>(
        `SELECT id, email::text, password_hash, status, email_verified_at,
                failed_login_count, locked_until
           FROM users WHERE email = $1 LIMIT 1`,
        [email],
      );
      const user = result.rows[0];
      if (!user) return null;
      await client.query("SELECT set_config('app.user_id', $1, true), set_config('app.user_role', 'customer', true)", [user.id]);
      const roleResult = await client.query<{ name: string }>(
        'SELECT r.name FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = $1',
        [user.id],
      );
      return { ...user, roles: roleResult.rows.map((row) => row.name) };
    });
  }

  async getSession(rawToken: string): Promise<AuthContext | null> {
    if (rawToken.length < 32 || rawToken.length > 200) return null;
    const sessionHash = hashToken(rawToken);

    return inTransaction(this.pool, async (client) => {
      await client.query("SELECT set_config('app.session_hash', $1, true)", [sessionHash]);
      const sessionResult = await client.query<{
        id: string; user_id: string; csrf_hash: string;
      }>(
        `SELECT id, user_id, csrf_hash FROM sessions
          WHERE token_hash = $1 AND invalidated_at IS NULL AND expires_at > now()
          LIMIT 1 FOR UPDATE`,
        [sessionHash],
      );
      const session = sessionResult.rows[0];
      if (!session) return null;

      await client.query("SELECT set_config('app.user_id', $1, true), set_config('app.user_role', 'customer', true)", [session.user_id]);
      const userResult = await client.query<{
        email: string; status: string; email_verified_at: Date | null; full_name: string | null; phone: string | null; roles: string[];
      }>(
        `SELECT u.email::text, u.status, u.email_verified_at, p.full_name, p.phone,
                COALESCE(array_agg(r.name) FILTER (WHERE r.name IS NOT NULL), ARRAY['customer']::text[]) AS roles
           FROM users u
           LEFT JOIN profiles p ON p.user_id = u.id
           LEFT JOIN user_roles ur ON ur.user_id = u.id
           LEFT JOIN roles r ON r.id = ur.role_id
          WHERE u.id = $1
          GROUP BY u.id, p.user_id`,
        [session.user_id],
      );
      const user = userResult.rows[0];
      if (!user || user.status !== 'active' || !user.roles.includes('admin')) return null;

      await client.query('UPDATE sessions SET last_seen_at = now() WHERE id = $1', [session.id]);
      return {
        userId: session.user_id,
        sessionId: session.id,
        sessionHash,
        csrfHash: session.csrf_hash,
        email: user.email,
        roles: user.roles,
        fullName: user.full_name,
        phone: user.phone,
        emailVerified: Boolean(user.email_verified_at),
      };
    });
  }

  async login(input: { email: string; password: string }, meta: RequestMeta): Promise<SessionResult> {
    const user = await this.lookupUser(input.email);
    const passwordValid = await verifyPassword(user?.password_hash ?? undefined, input.password);
    const locked = Boolean(user?.locked_until && user.locked_until.getTime() > Date.now());

    if (!user || !passwordValid || user.status !== 'active' || locked || !user.roles.includes('admin')) {
      await inTransaction(this.pool, async (client) => {
        await client.query("SELECT set_config('app.auth_event', 'true', true)");
        if (user) {
          await client.query("SELECT set_config('app.user_id', $1, true), set_config('app.user_role', 'customer', true)", [user.id]);
          const failures = user.failed_login_count + 1;
          const lockMinutes = failures >= 10 ? 60 : failures >= 5 ? 15 : 0;
          await client.query(
            `UPDATE users SET failed_login_count = $2,
              locked_until = CASE WHEN $3 > 0 THEN now() + ($3 || ' minutes')::interval ELSE locked_until END
              WHERE id = $1`,
            [user.id, failures, lockMinutes],
          );
        }
        await this.recordAttempt(client, input.email, meta, false);
      });
      throw INVALID_CREDENTIALS;
    }

    return inTransaction(this.pool, async (client) => {
      await client.query("SELECT set_config('app.user_id', $1, true), set_config('app.user_role', 'customer', true), set_config('app.auth_event', 'true', true)", [user.id]);
      const roles = user.roles;
      await client.query("SELECT set_config('app.user_role', 'admin', true)");
      await client.query('UPDATE users SET failed_login_count = 0, locked_until = NULL WHERE id = $1', [user.id]);

      const profile = await client.query<{ full_name: string | null; phone: string | null }>('SELECT full_name, phone FROM profiles WHERE user_id = $1', [user.id]);
      const token = randomToken();
      const csrfToken = randomToken();
      await client.query<{ id: string }>(
        `INSERT INTO sessions (user_id, token_hash, csrf_hash, ip_hash, user_agent, expires_at)
         VALUES ($1, $2, $3, $4, $5, now() + ($6 || ' hours')::interval) RETURNING id`,
        [user.id, hashToken(token), hashToken(csrfToken), this.ipHash(meta), meta.userAgent?.slice(0, 300) ?? null, this.env.SESSION_TTL_HOURS],
      );
      await this.recordAttempt(client, input.email, meta, true);

      return {
        token,
        csrfToken,
        user: {
          userId: user.id,
          email: user.email,
          roles,
          fullName: profile.rows[0]?.full_name ?? null,
          phone: profile.rows[0]?.phone ?? null,
          emailVerified: Boolean(user.email_verified_at),
        },
      };
    });
  }

  private async recordAttempt(client: PoolClient, email: string, meta: RequestMeta, succeeded: boolean) {
    await client.query("SELECT set_config('app.auth_event', 'true', true)");
    await client.query(
      'INSERT INTO login_attempts (account_hash, ip_hash, succeeded) VALUES ($1, $2, $3)',
      [hashIdentifier(email, this.env.IP_HASH_SECRET), this.ipHash(meta), succeeded],
    );
  }

  async logout(auth: AuthContext) {
    await withAuthContext(this.pool, auth, (client) =>
      client.query('UPDATE sessions SET invalidated_at = now() WHERE id = $1 AND user_id = $2', [auth.sessionId, auth.userId]).then(() => undefined),
    );
  }

  async rotateCsrf(auth: AuthContext) {
    const csrfToken = randomToken();
    await withAuthContext(this.pool, auth, (client) =>
      client.query('UPDATE sessions SET csrf_hash = $1 WHERE id = $2 AND user_id = $3', [hashToken(csrfToken), auth.sessionId, auth.userId]).then(() => undefined),
    );
    return csrfToken;
  }

  async forgotPassword(email: string) {
    const user = await this.lookupUser(email);
    if (!user || user.status !== 'active' || !user.roles.includes('admin')) return;

    const token = randomToken();
    await inTransaction(this.pool, async (client) => {
      await client.query("SELECT set_config('app.user_id', $1, true), set_config('app.user_role', 'customer', true)", [user.id]);
      await client.query('UPDATE password_reset_tokens SET consumed_at = now() WHERE user_id = $1 AND consumed_at IS NULL', [user.id]);
      await client.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, now() + interval '30 minutes')`,
        [user.id, hashToken(token)],
      );
    });
    await this.email.send({
      to: user.email,
      subject: 'Restablece tu contraseña de Celestial',
      text: `Crea una contraseña nueva: ${this.env.allowedOrigins[0]}/restablecer-contrasena?token=${encodeURIComponent(token)}\n\nEste enlace vence en 30 minutos.`,
    });
  }

  async resetPassword(token: string, password: string) {
    const tokenHash = hashToken(token);
    const passwordHash = await hashPassword(password);
    const consumed = await inTransaction(this.pool, async (client) => {
      await client.query("SELECT set_config('app.reset_hash', $1, true)", [tokenHash]);
      const result = await client.query<{ id: string; user_id: string }>(
        `SELECT id, user_id FROM password_reset_tokens
          WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now()
          LIMIT 1 FOR UPDATE`,
        [tokenHash],
      );
      const reset = result.rows[0];
      if (!reset) return false;
      await client.query("SELECT set_config('app.user_id', $1, true), set_config('app.user_role', 'customer', true)", [reset.user_id]);
      const role = await client.query(
        `SELECT 1 FROM user_roles ur JOIN roles r ON r.id = ur.role_id
          WHERE ur.user_id = $1 AND r.name = 'admin' LIMIT 1`,
        [reset.user_id],
      );
      if (!role.rowCount) return false;
      await client.query("SELECT set_config('app.user_role', 'admin', true)");
      await client.query('UPDATE users SET password_hash = $2, password_changed_at = now(), failed_login_count = 0, locked_until = NULL WHERE id = $1', [reset.user_id, passwordHash]);
      await client.query('UPDATE password_reset_tokens SET consumed_at = now() WHERE id = $1', [reset.id]);
      await client.query('UPDATE sessions SET invalidated_at = now() WHERE user_id = $1 AND invalidated_at IS NULL', [reset.user_id]);
      return true;
    });
    if (!consumed) throw new HttpError(400, 'El enlace no es válido o ya venció.', 'INVALID_RESET_TOKEN');
  }

  async updateProfile(auth: AuthContext, input: { fullName?: string; phone?: string | null; avatarUrl?: string | null }) {
    await withAuthContext(this.pool, auth, (client) => client.query(
      `UPDATE profiles SET
        full_name = CASE WHEN $2 THEN $3 ELSE full_name END,
        phone = CASE WHEN $4 THEN $5 ELSE phone END,
        avatar_url = CASE WHEN $6 THEN $7 ELSE avatar_url END
       WHERE user_id = $1`,
      [
        auth.userId,
        Object.hasOwn(input, 'fullName'), input.fullName ?? null,
        Object.hasOwn(input, 'phone'), input.phone ?? null,
        Object.hasOwn(input, 'avatarUrl'), input.avatarUrl ?? null,
      ],
    ).then(() => undefined));
    return {
      ...auth,
      fullName: Object.hasOwn(input, 'fullName') ? input.fullName ?? auth.fullName : auth.fullName,
      phone: Object.hasOwn(input, 'phone') ? input.phone ?? null : auth.phone,
    };
  }

  async changePassword(auth: AuthContext, currentPassword: string, newPassword: string) {
    const current = await withAuthContext(this.pool, auth, async (client) => {
      const result = await client.query<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [auth.userId]);
      return result.rows[0]?.password_hash;
    });
    if (!await verifyPassword(current, currentPassword)) throw INVALID_CREDENTIALS;

    const passwordHash = await hashPassword(newPassword);
    await withAuthContext(this.pool, auth, async (client) => {
      await client.query('UPDATE users SET password_hash = $2, password_changed_at = now() WHERE id = $1', [auth.userId, passwordHash]);
      await client.query('UPDATE sessions SET invalidated_at = now() WHERE user_id = $1 AND invalidated_at IS NULL', [auth.userId]);
    });
  }
}
