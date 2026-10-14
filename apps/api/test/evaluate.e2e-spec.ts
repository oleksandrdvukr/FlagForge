import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { CLOCK, FakeClock } from '../src/common/clock/clock';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { RATE_LIMIT_CONFIG } from '../src/evaluation/rate-limit.guard';
import { createTestApp } from './utils/create-test-app';
import { seedFlag, seedWorkspace, type SeededWorkspace } from './utils/seed';

const WRITE_OPERATIONS = /create|update|delete|upsert|executeRaw/i;

describe('POST /api/v1/evaluate (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ws: SeededWorkspace;
  const operations: string[] = [];

  beforeAll(async () => {
    // Records every database operation so FR-24 (zero writes) can be asserted per request.
    const recording = new PrismaClient().$extends({
      query: {
        $allOperations({ operation, args, query }) {
          operations.push(operation);
          return query(args);
        },
      },
    });
    app = await createTestApp((b) => b.overrideProvider(PrismaService).useValue(recording));
    prisma = app.get(PrismaService);
    ws = await seedWorkspace(app);
    await seedFlag(prisma, ws.production.id, {
      key: 'on-for-all',
      isEnabled: true,
      percentageRollout: 100,
    });
    await seedFlag(prisma, ws.production.id, { key: 'off-flag', isEnabled: false });
    await seedFlag(prisma, ws.production.id, {
      key: 'archived-flag',
      isEnabled: true,
      percentageRollout: 100,
      archivedAt: new Date('2026-10-14T10:00:00.000Z'),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  /** Pass `null` as `sdkKey` to omit the header. */
  const evaluate = (body: unknown, sdkKey: string | null = ws.production.sdkKey) => {
    const req = request(app.getHttpServer()).post('/api/v1/evaluate');
    if (sdkKey !== null) req.set('X-Environment-Key', sdkKey);
    return req.send(body as object);
  };

  describe('happy path', () => {
    it('FR-20: returns { flagKey, value, reason }', async () => {
      const res = await evaluate({ flagKey: 'on-for-all', userId: 'usr_1' }).expect(200);
      expect(res.body).toEqual({
        flagKey: 'on-for-all',
        value: true,
        reason: 'PERCENTAGE_ROLLOUT',
      });
    });

    it('FR-22: works without userId and attributes', async () => {
      const res = await evaluate({ flagKey: 'on-for-all' }).expect(200);
      expect(res.body).toEqual({ flagKey: 'on-for-all', value: false, reason: 'MISSING_USER_ID' });
    });

    it('FR-24: performs zero database writes', async () => {
      operations.length = 0;
      await evaluate({
        flagKey: 'on-for-all',
        userId: 'usr_1',
        attributes: { plan: 'pro' },
      }).expect(200);
      await evaluate({ flagKey: 'off-flag', userId: 'usr_1' }).expect(200);
      await evaluate({ flagKey: 'missing-flag', userId: 'usr_1' }).expect(404);

      expect(operations.length).toBeGreaterThan(0);
      expect(operations.filter((op) => WRITE_OPERATIONS.test(op))).toEqual([]);
    });
  });

  describe('authentication (FR-33)', () => {
    it('FR-33: returns 401 without the X-Environment-Key header', async () => {
      const res = await evaluate({ flagKey: 'on-for-all' }, null).expect(401);
      expect(res.body).toEqual({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Missing or invalid SDK key',
      });
    });

    it('FR-33: returns 401 for an unknown key', async () => {
      await evaluate({ flagKey: 'on-for-all' }, 'ff_live_not-a-real-key').expect(401);
    });

    it('FR-33: authenticates before validating the body', async () => {
      await evaluate({ flagKey: 'X' }, 'ff_live_not-a-real-key').expect(401);
    });

    it('FR-05: a rotated-away key is rejected immediately', async () => {
      const other = await seedWorkspace(app);
      await request(app.getHttpServer())
        .post(`/api/v1/environments/${other.production.id}/sdk-key/rotate`)
        .expect(200);
      await evaluate({ flagKey: 'on-for-all' }, other.production.sdkKey).expect(401);
    });

    it('FR-33: a key only sees flags of its own environment', async () => {
      await evaluate({ flagKey: 'on-for-all', userId: 'u' }, ws.development.sdkKey).expect(404);
    });
  });

  describe('validation (SEC-03)', () => {
    it.each([
      [{}, 'flagKey'],
      [{ flagKey: 'Bad Key' }, 'flagKey'],
      [{ flagKey: 'on-for-all', userId: '' }, 'userId'],
      [{ flagKey: 'on-for-all', attributes: { plan: { nested: true } } }, 'attributes'],
    ])('SEC-03: rejects %p with 400 pointing at %p', async (body, field) => {
      const res = await evaluate(body).expect(400);
      expect(res.body).toMatchObject({ statusCode: 400, message: 'Validation failed' });
      expect((res.body as { details: { path: string[] }[] }).details[0]?.path[0]).toBe(field);
    });
  });

  describe('flag lookup', () => {
    it('returns 404 for an unknown flag', async () => {
      const res = await evaluate({ flagKey: 'missing-flag', userId: 'u' }).expect(404);
      expect(res.body).toEqual({
        statusCode: 404,
        error: 'Not Found',
        message: 'Flag "missing-flag" not found',
      });
    });

    it('FR-13: returns 404 for an archived flag', async () => {
      await evaluate({ flagKey: 'archived-flag', userId: 'u' }).expect(404);
    });
  });
});

describe('POST /api/v1/evaluate — rate limiting (e2e)', () => {
  let app: INestApplication;
  let ws: SeededWorkspace;
  const clock = new FakeClock('2026-10-14T10:00:00.000Z');

  beforeAll(async () => {
    // A tiny bucket keeps the test fast; the 1000/min numbers are covered in token-bucket.spec.ts.
    app = await createTestApp((b) =>
      b
        .overrideProvider(RATE_LIMIT_CONFIG)
        .useValue({ capacity: 3, refillPerSecond: 1 })
        .overrideProvider(CLOCK)
        .useValue(clock),
    );
    ws = await seedWorkspace(app);
    await seedFlag(app.get(PrismaService), ws.production.id, { key: 'limited', isEnabled: true });
  });

  afterAll(async () => {
    await app.close();
  });

  const evaluate = (sdkKey: string) =>
    request(app.getHttpServer())
      .post('/api/v1/evaluate')
      .set('X-Environment-Key', sdkKey)
      .send({ flagKey: 'limited', userId: 'u' });

  it('SEC-04: returns 429 with Retry-After once the bucket is empty, then recovers', async () => {
    for (let i = 0; i < 3; i++) await evaluate(ws.production.sdkKey).expect(200);

    const limited = await evaluate(ws.production.sdkKey).expect(429);
    expect(limited.headers['retry-after']).toBe('1');
    expect(limited.body).toEqual({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
    });

    clock.advance(1000);
    await evaluate(ws.production.sdkKey).expect(200);
  });

  it('SEC-04: limits are per SDK key / environment', async () => {
    const res = await evaluate(ws.development.sdkKey);
    expect(res.status).not.toBe(429);
  });

  it('SEC-04: invalid keys are rejected before consuming any tokens', async () => {
    const fresh = await seedWorkspace(app);
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/evaluate')
        .set('X-Environment-Key', 'ff_live_bogus')
        .send({ flagKey: 'limited' })
        .expect(401);
    }
    expect((await evaluate(fresh.production.sdkKey)).status).toBe(404);
  });
});
