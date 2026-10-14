import { createHash, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import type { CreateWorkspaceResponse, EnvironmentDto, SdkKeyResponse } from '@flagforge/shared';
import request from 'supertest';
import { CLOCK, FakeClock } from '../src/common/clock/clock';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { EnvironmentsService } from '../src/environments/environments.service';
import { createTestApp } from './utils/create-test-app';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

describe('Workspaces & environments (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const clock = new FakeClock('2026-10-14T10:00:00.000Z');

  beforeAll(async () => {
    app = await createTestApp((b) => b.overrideProvider(CLOCK).useValue(clock));
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  async function createWorkspace(name = `Acme ${randomUUID()}`): Promise<CreateWorkspaceResponse> {
    const res = await http().post('/api/v1/workspaces').send({ name }).expect(201);
    return res.body as CreateWorkspaceResponse;
  }

  describe('POST /api/v1/workspaces', () => {
    it('FR-01, FR-02: creates the workspace with Development and Production environments', async () => {
      const { workspace, environments } = await createWorkspace('  Acme Corp  ');

      expect(workspace).toEqual({
        id: expect.any(String),
        name: 'Acme Corp',
        createdAt: '2026-10-14T10:00:00.000Z',
      });
      expect(environments.map((e) => [e.name, e.sdkKeyPrefix])).toEqual([
        ['Development', 'ff_test_'],
        ['Production', 'ff_live_'],
      ]);
      expect(environments.every((e) => e.workspaceId === workspace.id)).toBe(true);
    });

    it('FR-03: returns a prefixed, unique SDK key per environment', async () => {
      const { environments } = await createWorkspace();
      const [dev, prod] = environments;
      expect(dev?.sdkKey).toMatch(/^ff_test_[A-Za-z0-9_-]{43}$/);
      expect(prod?.sdkKey).toMatch(/^ff_live_[A-Za-z0-9_-]{43}$/);
      expect(dev?.sdkKey).not.toBe(prod?.sdkKey);
    });

    it('FR-04, SEC-01: stores only the SHA-256 hash of each SDK key', async () => {
      const { environments } = await createWorkspace();
      for (const env of environments) {
        const row = await prisma.environment.findUniqueOrThrow({ where: { id: env.id } });
        expect(row.sdkKeyHash).toBe(sha256(env.sdkKey));
        expect(JSON.stringify(row)).not.toContain(env.sdkKey);
      }
    });

    it('FR-01: is atomic — no workspace is left behind if environment creation fails', async () => {
      const name = `Atomic ${randomUUID()}`;
      const spy = jest
        .spyOn(app.get(EnvironmentsService), 'createDefaults')
        .mockRejectedValueOnce(new Error('boom'));

      await http().post('/api/v1/workspaces').send({ name }).expect(500);
      expect(await prisma.workspace.count({ where: { name } })).toBe(0);
      spy.mockRestore();
    });

    it.each([{}, { name: '' }, { name: '   ' }, { name: 'x'.repeat(101) }, { name: 42 }])(
      'SEC-03: rejects invalid body %p with 400 and details',
      async (body) => {
        const res = await http().post('/api/v1/workspaces').send(body).expect(400);
        expect(res.body).toMatchObject({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Validation failed',
          details: [{ path: ['name'], message: expect.any(String) }],
        });
      },
    );
  });

  describe('GET /api/v1/workspaces', () => {
    it('FR-01: lists workspaces newest first, without SDK keys', async () => {
      clock.set('2030-01-01T00:00:00.000Z');
      const older = await createWorkspace();
      clock.set('2030-01-02T00:00:00.000Z');
      const newer = await createWorkspace();

      const res = await http().get('/api/v1/workspaces').expect(200);
      const ids = (res.body as { id: string }[]).map((w) => w.id);
      expect(ids.indexOf(newer.workspace.id)).toBeLessThan(ids.indexOf(older.workspace.id));
      expect(JSON.stringify(res.body)).not.toContain('ff_');
    });
  });

  describe('GET /api/v1/workspaces/:workspaceId/environments', () => {
    it('FR-02, FR-04: lists environments with prefixes but never the keys', async () => {
      const { workspace, environments } = await createWorkspace();
      const res = await http().get(`/api/v1/workspaces/${workspace.id}/environments`).expect(200);
      const body = res.body as EnvironmentDto[];

      expect(body.map((e) => e.name)).toEqual(['Development', 'Production']);
      expect(body[0]).not.toHaveProperty('sdkKey');
      expect(body[0]).not.toHaveProperty('sdkKeyHash');
      for (const env of environments) expect(JSON.stringify(body)).not.toContain(env.sdkKey);
    });

    it('returns 404 for an unknown workspace', async () => {
      await http().get(`/api/v1/workspaces/${randomUUID()}/environments`).expect(404);
    });

    it('SEC-03: returns 400 for a malformed workspace id', async () => {
      await http().get('/api/v1/workspaces/not-a-uuid/environments').expect(400);
    });
  });

  describe('POST /api/v1/environments/:environmentId/sdk-key/rotate', () => {
    it('FR-05: returns a new key and invalidates the old one immediately', async () => {
      const { environments } = await createWorkspace();
      const prod = environments[1]!;
      const environmentsService = app.get(EnvironmentsService);

      const res = await http().post(`/api/v1/environments/${prod.id}/sdk-key/rotate`).expect(200);
      const rotated = res.body as SdkKeyResponse;

      expect(rotated.environmentId).toBe(prod.id);
      expect(rotated.sdkKey).toMatch(/^ff_live_/);
      expect(rotated.sdkKey).not.toBe(prod.sdkKey);
      expect(await environmentsService.findBySdkKey(prod.sdkKey)).toBeNull();
      expect((await environmentsService.findBySdkKey(rotated.sdkKey))?.id).toBe(prod.id);
    });

    it('SEC-01: stores only the hash of the rotated key', async () => {
      const { environments } = await createWorkspace();
      const dev = environments[0]!;
      const res = await http().post(`/api/v1/environments/${dev.id}/sdk-key/rotate`).expect(200);
      const row = await prisma.environment.findUniqueOrThrow({ where: { id: dev.id } });
      expect(row.sdkKeyHash).toBe(sha256((res.body as SdkKeyResponse).sdkKey));
    });

    it('returns 404 for an unknown environment', async () => {
      await http().post(`/api/v1/environments/${randomUUID()}/sdk-key/rotate`).expect(404);
    });
  });

  describe('SDK key lookup', () => {
    it('FR-33: resolves a raw key to its environment and rejects unknown keys', async () => {
      const { environments } = await createWorkspace();
      const service = app.get(EnvironmentsService);
      expect((await service.findBySdkKey(environments[0]!.sdkKey))?.id).toBe(environments[0]!.id);
      expect(await service.findBySdkKey('ff_live_unknown')).toBeNull();
    });
  });
});
