import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import type { CreateWorkspaceResponse, TargetingRule } from '@flagforge/shared';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { loginCookie } from './auth';

export interface SeededWorkspace {
  workspaceId: string;
  development: { id: string; sdkKey: string };
  production: { id: string; sdkKey: string };
}

/** Creates a workspace through the public API and returns its environments and raw SDK keys. */
export async function seedWorkspace(app: INestApplication): Promise<SeededWorkspace> {
  // Log in first: building a supertest request and awaiting another one mid-chain closes its server.
  const cookie = await loginCookie(app);
  const res = await request(app.getHttpServer())
    .post('/api/v1/workspaces')
    .set('Cookie', cookie)
    .send({ name: `ws-${randomUUID()}` })
    .expect(201);
  const { workspace, environments } = res.body as CreateWorkspaceResponse;
  const [development, production] = environments;
  return {
    workspaceId: workspace.id,
    development: { id: development!.id, sdkKey: development!.sdkKey },
    production: { id: production!.id, sdkKey: production!.sdkKey },
  };
}

export interface FlagSeed {
  key: string;
  isEnabled?: boolean;
  percentageRollout?: number;
  targetingRules?: TargetingRule[];
  archivedAt?: Date | null;
}

/** Inserts a flag directly, bypassing the API (and its audit log) for evaluation-focused tests. */
export function seedFlag(prisma: PrismaClient, environmentId: string, flag: FlagSeed) {
  return prisma.featureFlag.create({
    data: {
      environmentId,
      key: flag.key,
      name: flag.key,
      isEnabled: flag.isEnabled ?? false,
      percentageRollout: flag.percentageRollout ?? 0,
      targetingRules: flag.targetingRules ?? [],
      archivedAt: flag.archivedAt ?? null,
    },
  });
}
