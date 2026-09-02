import type { PoolClient } from 'pg';

export type AuthContext = {
  userId: string;
  sessionId: string;
  sessionHash: string;
  csrfHash: string;
  email: string;
  roles: string[];
  fullName: string | null;
  emailVerified: boolean;
};

export type DbExecutor = Pick<PoolClient, 'query'>;

export type SessionResult = {
  token: string;
  csrfToken: string;
  user: Pick<AuthContext, 'userId' | 'email' | 'roles' | 'fullName' | 'emailVerified'>;
};

declare global {
  // Express uses declaration merging for request-scoped authentication.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}
