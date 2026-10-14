import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Resolves the test database URL: `TEST_DATABASE_URL` if set, otherwise `DATABASE_URL`
 * (from the environment or the repo-root `.env`) with `_test` appended to the database name,
 * so tests never touch the development database.
 */
export function resolveTestDatabaseUrl(): string {
  const envFile = resolve(__dirname, '../../../../.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  if (!process.env.DATABASE_URL) {
    throw new Error('Set DATABASE_URL or TEST_DATABASE_URL to run tests (see .env.example)');
  }
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `${url.pathname.replace(/_test$/, '')}_test`;
  return url.toString();
}
