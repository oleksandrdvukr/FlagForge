import { z } from 'zod';

/** SEC-02: session lifetime. */
export const SESSION_TTL_SECONDS = 12 * 60 * 60;
export const SESSION_COOKIE = 'ff_session';

const authEnvSchema = z.object({
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  ADMIN_EMAIL: z.email('ADMIN_EMAIL must be a valid email'),
  ADMIN_PASSWORD_HASH: z
    .string()
    .regex(/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/, 'ADMIN_PASSWORD_HASH must be a bcrypt hash'),
  NODE_ENV: z.string().optional(),
  COOKIE_SECURE: z.enum(['true', 'false']).optional(),
});

export interface AuthConfig {
  jwtSecret: string;
  adminEmail: string;
  adminPasswordHash: string;
  /** `Secure` cookie flag: `COOKIE_SECURE` if set, otherwise on in production. */
  secureCookies: boolean;
}

export const AUTH_CONFIG = Symbol('AUTH_CONFIG');

/** ADR-0006: single env-configured admin. Fails fast at startup on missing or invalid values. */
export function authConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const result = authEnvSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid auth configuration — ${problems.join('; ')}`);
  }
  const { JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD_HASH, NODE_ENV, COOKIE_SECURE } = result.data;
  return {
    jwtSecret: JWT_SECRET,
    adminEmail: ADMIN_EMAIL.toLowerCase(),
    adminPasswordHash: ADMIN_PASSWORD_HASH,
    secureCookies: COOKIE_SECURE ? COOKIE_SECURE === 'true' : NODE_ENV === 'production',
  };
}
