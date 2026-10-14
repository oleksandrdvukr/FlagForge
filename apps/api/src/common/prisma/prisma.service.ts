import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** Builds the datasource URL with the pool size from `DATABASE_POOL_SIZE` (design §5.6). */
export function databaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set');
  const url = new URL(raw);
  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', env.DATABASE_POOL_SIZE ?? '10');
  }
  return url.toString();
}

/**
 * Prisma connects lazily on the first query, so the process starts even when the
 * database is down and `/readyz` can report it (NFR-03).
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ datasourceUrl: databaseUrl() });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
