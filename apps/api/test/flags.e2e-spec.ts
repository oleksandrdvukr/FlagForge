import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import type { AuditLogDto, FlagDto, Page, TargetingRule } from '@flagforge/shared';
import request from 'supertest';
import { AuditService } from '../src/audit/audit.service';
import { CLOCK, FakeClock } from '../src/common/clock/clock';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { TEST_ADMIN, loginCookie } from './utils/auth';
import { createTestApp } from './utils/create-test-app';
import { seedWorkspace, type SeededWorkspace } from './utils/seed';

const enterpriseRule: TargetingRule = {
  attribute: 'plan',
  operator: 'EQUALS',
  values: ['enterprise'],
  value: true,
};

describe('Flags & audit log (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string;
  const clock = new FakeClock('2026-10-14T10:00:00.000Z');

  beforeAll(async () => {
    app = await createTestApp((b) => b.overrideProvider(CLOCK).useValue(clock));
    prisma = app.get(PrismaService);
    cookie = await loginCookie(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const api = {
    get: (url: string) => request(app.getHttpServer()).get(url).set('Cookie', cookie),
    post: (url: string) => request(app.getHttpServer()).post(url).set('Cookie', cookie),
    patch: (url: string) => request(app.getHttpServer()).patch(url).set('Cookie', cookie),
    delete: (url: string) => request(app.getHttpServer()).delete(url).set('Cookie', cookie),
  };

  async function createFlag(envId: string, body: object): Promise<FlagDto> {
    const res = await api.post(`/api/v1/environments/${envId}/flags`).send(body).expect(201);
    return res.body as FlagDto;
  }

  async function auditLogs(envId: string, query = ''): Promise<Page<AuditLogDto>> {
    const res = await api.get(`/api/v1/environments/${envId}/audit-logs${query}`).expect(200);
    return res.body as Page<AuditLogDto>;
  }

  const evaluate = (sdkKey: string, body: object) =>
    request(app.getHttpServer())
      .post('/api/v1/evaluate')
      .set('X-Environment-Key', sdkKey)
      .send(body);

  describe('POST /environments/:id/flags', () => {
    let ws: SeededWorkspace;
    beforeAll(async () => {
      ws = await seedWorkspace(app);
    });

    it('FR-10: creates a flag in the Disabled state with defaults (SRS §4.5)', async () => {
      const flag = await createFlag(ws.production.id, {
        key: 'new-checkout',
        name: 'New checkout',
        description: 'Redesigned checkout flow',
      });
      expect(flag).toEqual({
        id: expect.any(String),
        environmentId: ws.production.id,
        key: 'new-checkout',
        name: 'New checkout',
        description: 'Redesigned checkout flow',
        isEnabled: false,
        percentageRollout: 0,
        targetingRules: [],
        createdAt: '2026-10-14T10:00:00.000Z',
        updatedAt: '2026-10-14T10:00:00.000Z',
      });
    });

    it('FR-10: accepts rollout and targeting rules on create', async () => {
      const flag = await createFlag(ws.production.id, {
        key: 'beta',
        name: 'Beta',
        isEnabled: true,
        percentageRollout: 25,
        targetingRules: [enterpriseRule],
      });
      expect(flag).toMatchObject({
        isEnabled: true,
        percentageRollout: 25,
        targetingRules: [enterpriseRule],
      });
    });

    it('FR-10: returns 409 for a duplicate key in the same environment', async () => {
      await createFlag(ws.production.id, { key: 'dup', name: 'Dup' });
      const res = await api
        .post(`/api/v1/environments/${ws.production.id}/flags`)
        .send({ key: 'dup', name: 'Dup again' })
        .expect(409);
      expect(res.body).toEqual({
        statusCode: 409,
        error: 'Conflict',
        message: 'Flag "dup" already exists in this environment',
      });
    });

    it('FR-10: allows the same key in another environment', async () => {
      await createFlag(ws.development.id, { key: 'dup', name: 'Dup' });
    });

    it.each([
      [{ name: 'No key' }],
      [{ key: 'Bad Key', name: 'x' }],
      [{ key: 'ok-key', name: 'x', percentageRollout: 150 }],
      [
        {
          key: 'ok-key',
          name: 'x',
          targetingRules: [{ attribute: 'plan', operator: 'LIKE', values: ['x'], value: true }],
        },
      ],
      [{ key: 'ok-key', name: 'x', extra: 1 }],
    ])('SEC-03: rejects invalid body %p', async (body) => {
      await api.post(`/api/v1/environments/${ws.production.id}/flags`).send(body).expect(400);
    });

    it('returns 404 for an unknown environment', async () => {
      await api
        .post(`/api/v1/environments/${randomUUID()}/flags`)
        .send({ key: 'x-flag', name: 'x' })
        .expect(404);
    });
  });

  describe('GET /environments/:id/flags', () => {
    let ws: SeededWorkspace;
    beforeAll(async () => {
      ws = await seedWorkspace(app);
      for (const [i, key] of ['checkout-v2', 'checkout-v3', 'dark-mode', 'search-ai'].entries()) {
        clock.set(`2026-10-14T10:0${i}:00.000Z`);
        await createFlag(ws.production.id, { key, name: key.replace('-', ' ').toUpperCase() });
      }
    });

    it('FR-11: lists flags newest first with pagination metadata', async () => {
      const res = await api
        .get(`/api/v1/environments/${ws.production.id}/flags?pageSize=3`)
        .expect(200);
      const page = res.body as Page<FlagDto>;
      expect(page.total).toBe(4);
      expect(page.page).toBe(1);
      expect(page.pageSize).toBe(3);
      expect(page.items.map((f) => f.key)).toEqual(['search-ai', 'dark-mode', 'checkout-v3']);
    });

    it('FR-11: returns the next page', async () => {
      const res = await api
        .get(`/api/v1/environments/${ws.production.id}/flags?page=2&pageSize=3`)
        .expect(200);
      expect((res.body as Page<FlagDto>).items.map((f) => f.key)).toEqual(['checkout-v2']);
    });

    it('FR-11: searches by key or name, case-insensitively', async () => {
      const byKey = await api
        .get(`/api/v1/environments/${ws.production.id}/flags?q=CHECKOUT`)
        .expect(200);
      expect((byKey.body as Page<FlagDto>).items.map((f) => f.key).sort()).toEqual([
        'checkout-v2',
        'checkout-v3',
      ]);
      const byName = await api
        .get(`/api/v1/environments/${ws.production.id}/flags?q=dark mode`)
        .expect(200);
      expect((byName.body as Page<FlagDto>).items.map((f) => f.key)).toEqual(['dark-mode']);
    });

    it('SEC-03: rejects invalid pagination', async () => {
      await api.get(`/api/v1/environments/${ws.production.id}/flags?pageSize=1000`).expect(400);
    });
  });

  describe('PATCH /flags/:id', () => {
    it('FR-12: updates isEnabled, percentageRollout and targetingRules', async () => {
      const ws = await seedWorkspace(app);
      const flag = await createFlag(ws.production.id, { key: 'patch-me', name: 'Patch me' });

      clock.set('2026-10-14T11:00:00.000Z');
      const res = await api
        .patch(`/api/v1/flags/${flag.id}`)
        .send({ isEnabled: true, percentageRollout: 40, targetingRules: [enterpriseRule] })
        .expect(200);
      expect(res.body).toMatchObject({
        isEnabled: true,
        percentageRollout: 40,
        targetingRules: [enterpriseRule],
        createdAt: flag.createdAt,
        updatedAt: '2026-10-14T11:00:00.000Z',
      });
    });

    it('FR-12: the kill-switch takes effect on the very next evaluation (ADR-0003)', async () => {
      const ws = await seedWorkspace(app);
      const flag = await createFlag(ws.production.id, {
        key: 'kill-me',
        name: 'Kill me',
        isEnabled: true,
        percentageRollout: 100,
      });
      const ctx = { flagKey: 'kill-me', userId: 'usr_1' };

      expect((await evaluate(ws.production.sdkKey, ctx).expect(200)).body).toMatchObject({
        value: true,
      });
      await api.patch(`/api/v1/flags/${flag.id}`).send({ isEnabled: false }).expect(200);
      expect((await evaluate(ws.production.sdkKey, ctx).expect(200)).body).toEqual({
        flagKey: 'kill-me',
        value: false,
        reason: 'DISABLED',
      });
    });

    it.each([[{}], [{ key: 'renamed' }], [{ percentageRollout: -1 }], [{ isEnabled: 'yes' }]])(
      'SEC-03: rejects invalid update %p',
      async (body) => {
        const ws = await seedWorkspace(app);
        const flag = await createFlag(ws.production.id, { key: 'strict', name: 'Strict' });
        await api.patch(`/api/v1/flags/${flag.id}`).send(body).expect(400);
      },
    );

    it('returns 404 for an unknown flag', async () => {
      await api.patch(`/api/v1/flags/${randomUUID()}`).send({ isEnabled: true }).expect(404);
    });
  });

  describe('DELETE /flags/:id (archive)', () => {
    it('FR-13: archives the flag — hidden from list and get, 404 on evaluate', async () => {
      const ws = await seedWorkspace(app);
      const flag = await createFlag(ws.production.id, {
        key: 'old-flag',
        name: 'Old',
        isEnabled: true,
        percentageRollout: 100,
      });

      await api.delete(`/api/v1/flags/${flag.id}`).expect(204);

      await api.get(`/api/v1/flags/${flag.id}`).expect(404);
      const list = await api.get(`/api/v1/environments/${ws.production.id}/flags`).expect(200);
      expect((list.body as Page<FlagDto>).total).toBe(0);
      await evaluate(ws.production.sdkKey, { flagKey: 'old-flag', userId: 'u' }).expect(404);
    });

    it('FR-13: keeps the row and its history (soft delete)', async () => {
      const ws = await seedWorkspace(app);
      const flag = await createFlag(ws.production.id, { key: 'kept', name: 'Kept' });
      await api.delete(`/api/v1/flags/${flag.id}`).expect(204);

      const row = await prisma.featureFlag.findUniqueOrThrow({ where: { id: flag.id } });
      expect(row.archivedAt).not.toBeNull();
    });

    it('SRS §4.5: Archived is terminal — no update, no second archive', async () => {
      const ws = await seedWorkspace(app);
      const flag = await createFlag(ws.production.id, { key: 'terminal', name: 'Terminal' });
      await api.delete(`/api/v1/flags/${flag.id}`).expect(204);

      await api.patch(`/api/v1/flags/${flag.id}`).send({ isEnabled: true }).expect(404);
      await api.delete(`/api/v1/flags/${flag.id}`).expect(404);
    });

    it('SRS §4.5: the key of an archived flag stays reserved', async () => {
      const ws = await seedWorkspace(app);
      const flag = await createFlag(ws.production.id, { key: 'reserved', name: 'Reserved' });
      await api.delete(`/api/v1/flags/${flag.id}`).expect(204);
      await api
        .post(`/api/v1/environments/${ws.production.id}/flags`)
        .send({ key: 'reserved', name: 'Again' })
        .expect(409);
    });
  });

  describe('audit log', () => {
    it('FR-30, FR-31: records CREATED, UPDATED and ARCHIVED with full snapshots', async () => {
      const ws = await seedWorkspace(app);
      clock.set('2026-10-14T12:00:00.000Z');
      const created = await createFlag(ws.production.id, { key: 'audited', name: 'Audited' });
      clock.set('2026-10-14T12:05:00.000Z');
      const updated = (
        await api.patch(`/api/v1/flags/${created.id}`).send({ isEnabled: true }).expect(200)
      ).body as FlagDto;
      clock.set('2026-10-14T12:10:00.000Z');
      await api.delete(`/api/v1/flags/${created.id}`).expect(204);

      const { items, total } = await auditLogs(ws.production.id);
      expect(total).toBe(3);
      const [archived, update, create] = items;

      expect(create).toEqual({
        id: expect.stringMatching(/^\d+$/),
        environmentId: ws.production.id,
        flagId: created.id,
        action: 'CREATED',
        actorId: TEST_ADMIN.email,
        previousState: null,
        newState: created,
        timestamp: '2026-10-14T12:00:00.000Z',
      });
      expect(update).toMatchObject({
        action: 'UPDATED',
        previousState: created,
        newState: updated,
        timestamp: '2026-10-14T12:05:00.000Z',
      });
      expect(archived).toMatchObject({
        action: 'ARCHIVED',
        previousState: updated,
        timestamp: '2026-10-14T12:10:00.000Z',
      });
    });

    it('FR-31: filters by flag and paginates newest first', async () => {
      const ws = await seedWorkspace(app);
      const a = await createFlag(ws.production.id, { key: 'flag-a', name: 'A' });
      await createFlag(ws.production.id, { key: 'flag-b', name: 'B' });
      await api.patch(`/api/v1/flags/${a.id}`).send({ percentageRollout: 10 }).expect(200);

      const onlyA = await auditLogs(ws.production.id, `?flagId=${a.id}`);
      expect(onlyA.total).toBe(2);
      expect(onlyA.items.map((l) => l.action)).toEqual(['UPDATED', 'CREATED']);

      const firstPage = await auditLogs(ws.production.id, '?pageSize=1');
      expect(firstPage).toMatchObject({ total: 3, page: 1, pageSize: 1 });
      expect(firstPage.items).toHaveLength(1);
    });

    it('FR-30: a failed mutation leaves no audit entry and no change (same transaction)', async () => {
      const ws = await seedWorkspace(app);
      const flag = await createFlag(ws.production.id, { key: 'atomic', name: 'Atomic' });
      const spy = jest
        .spyOn(app.get(AuditService), 'record')
        .mockRejectedValueOnce(new Error('audit store unavailable'));

      await api.patch(`/api/v1/flags/${flag.id}`).send({ isEnabled: true }).expect(500);
      spy.mockRestore();

      const after = await api.get(`/api/v1/flags/${flag.id}`).expect(200);
      expect((after.body as FlagDto).isEnabled).toBe(false);
      expect((await auditLogs(ws.production.id)).items.map((l) => l.action)).toEqual(['CREATED']);
    });

    it('FR-30: concurrent updates each record the true previous state', async () => {
      const ws = await seedWorkspace(app);
      const flag = await createFlag(ws.production.id, { key: 'race', name: 'Race' });

      await Promise.all(
        [10, 20, 30, 40, 50].map((pct) =>
          api.patch(`/api/v1/flags/${flag.id}`).send({ percentageRollout: pct }).expect(200),
        ),
      );

      // Oldest first: every entry's previous state must equal the prior entry's new state.
      const logs = (await auditLogs(ws.production.id, `?flagId=${flag.id}`)).items.reverse();
      for (let i = 1; i < logs.length; i++) {
        expect(logs[i]!.previousState?.percentageRollout).toBe(
          logs[i - 1]!.newState.percentageRollout,
        );
      }
    });

    it('returns 404 for an unknown environment', async () => {
      await api.get(`/api/v1/environments/${randomUUID()}/audit-logs`).expect(404);
    });
  });
});
