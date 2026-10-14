import { authConfigFromEnv } from './auth.config';

const valid = {
  JWT_SECRET: 'x'.repeat(32),
  ADMIN_EMAIL: 'Admin@Example.com',
  ADMIN_PASSWORD_HASH: '$2b$12$arEVZJ7Wcg7yyN87N4MqgOCvNmhP9q32r3PIz.KtkCR8bOxVKr4U2',
};

describe('authConfigFromEnv', () => {
  it('ADR-0006: reads the admin from env and normalizes the email', () => {
    expect(authConfigFromEnv(valid)).toEqual({
      jwtSecret: valid.JWT_SECRET,
      adminEmail: 'admin@example.com',
      adminPasswordHash: valid.ADMIN_PASSWORD_HASH,
      secureCookies: false,
    });
  });

  it('SEC-02: enables Secure cookies in production', () => {
    expect(authConfigFromEnv({ ...valid, NODE_ENV: 'production' }).secureCookies).toBe(true);
  });

  it('SEC-02: COOKIE_SECURE overrides the default (e.g. production over plain HTTP)', () => {
    expect(
      authConfigFromEnv({ ...valid, NODE_ENV: 'production', COOKIE_SECURE: 'false' }).secureCookies,
    ).toBe(false);
    expect(authConfigFromEnv({ ...valid, COOKIE_SECURE: 'true' }).secureCookies).toBe(true);
  });

  it.each([
    [{ ...valid, JWT_SECRET: 'short' }, 'JWT_SECRET'],
    [{ ...valid, COOKIE_SECURE: 'yes' }, 'COOKIE_SECURE'],
    [{ ...valid, ADMIN_EMAIL: 'nope' }, 'ADMIN_EMAIL'],
    [{ ...valid, ADMIN_PASSWORD_HASH: 'plain-text-password' }, 'ADMIN_PASSWORD_HASH'],
    [{ ...valid, ADMIN_PASSWORD_HASH: '' }, 'ADMIN_PASSWORD_HASH'],
  ])('fails fast on invalid config (%#: %s)', (env, field) => {
    expect(() => authConfigFromEnv(env)).toThrow(field);
  });
});
