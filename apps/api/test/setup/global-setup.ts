import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { resolveTestDatabaseUrl } from './test-env';

/**
 * Recreates the test database from the committed migrations before the test run:
 * create `<db>_test` if missing → drop its `public` schema → `prisma migrate deploy`.
 * Refuses to run against any database whose name does not end with `_test`.
 */
export default async function globalSetup(): Promise<void> {
  const databaseUrl = resolveTestDatabaseUrl();
  const url = new URL(databaseUrl);
  const dbName = decodeURIComponent(url.pathname.slice(1));
  if (!dbName.endsWith('_test')) {
    throw new Error(`Refusing to reset "${dbName}": test database name must end with "_test"`);
  }
  process.env.DATABASE_URL = databaseUrl;

  const maintenanceUrl = new URL(databaseUrl);
  maintenanceUrl.pathname = '/postgres';
  const admin = new PrismaClient({ datasourceUrl: maintenanceUrl.toString() });
  try {
    const exists = await admin.$queryRaw<
      unknown[]
    >`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
    if (exists.length === 0) await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
  } finally {
    await admin.$disconnect();
  }

  const testDb = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    await testDb.$executeRawUnsafe('DROP SCHEMA IF EXISTS public CASCADE');
    await testDb.$executeRawUnsafe('CREATE SCHEMA public');
  } finally {
    await testDb.$disconnect();
  }

  execSync('prisma migrate deploy', {
    cwd: resolve(__dirname, '../..'),
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'pipe',
  });
}
