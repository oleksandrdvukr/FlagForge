import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { createTestApp } from './utils/create-test-app';
import { seedFlag, seedWorkspace, type SeededWorkspace } from './utils/seed';

/** SRS §9 acceptance criteria, executed end to end over HTTP against a real database. */
describe('Acceptance criteria (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ws: SeededWorkspace;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    ws = await seedWorkspace(app);
  });

  afterAll(async () => {
    await app.close();
  });

  const evaluate = (body: object) =>
    request(app.getHttpServer())
      .post('/api/v1/evaluate')
      .set('X-Environment-Key', ws.production.sdkKey)
      .send(body)
      .expect(200);

  describe('AC-01: deterministic percentage rollout (FR-21, NFR-02)', () => {
    it('AC-01: 100 consecutive evaluations of usr_1001 at 30% all return true / PERCENTAGE_ROLLOUT', async () => {
      await seedFlag(prisma, ws.production.id, {
        key: 'new-checkout',
        isEnabled: true,
        percentageRollout: 30,
      });

      for (let i = 0; i < 100; i++) {
        const res = await evaluate({ flagKey: 'new-checkout', userId: 'usr_1001' });
        expect(res.body).toEqual({
          flagKey: 'new-checkout',
          value: true,
          reason: 'PERCENTAGE_ROLLOUT',
        });
      }
    });

    it('AC-01 boundary: at 28% (= bucket) the same user gets false / DEFAULT', async () => {
      const other = await seedWorkspace(app);
      await seedFlag(prisma, other.production.id, {
        key: 'new-checkout',
        isEnabled: true,
        percentageRollout: 28,
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/evaluate')
        .set('X-Environment-Key', other.production.sdkKey)
        .send({ flagKey: 'new-checkout', userId: 'usr_1001' })
        .expect(200);
      expect(res.body).toEqual({ flagKey: 'new-checkout', value: false, reason: 'DEFAULT' });
    });
  });

  describe('AC-02: targeting rule override (FR-21, FR-23)', () => {
    it('AC-02: plan EQUALS "enterprise" returns true / TARGETING_MATCH despite 0% rollout', async () => {
      await seedFlag(prisma, ws.production.id, {
        key: 'beta-dashboard',
        isEnabled: true,
        percentageRollout: 0,
        targetingRules: [
          { attribute: 'plan', operator: 'EQUALS', values: ['enterprise'], value: true },
        ],
      });

      const res = await evaluate({
        flagKey: 'beta-dashboard',
        userId: 'usr_99',
        attributes: { plan: 'enterprise' },
      });
      expect(res.body).toEqual({
        flagKey: 'beta-dashboard',
        value: true,
        reason: 'TARGETING_MATCH',
      });
    });
  });

  describe('AC-03: disabled master switch (FR-21)', () => {
    it('AC-03: isEnabled = false wins over 100% rollout and matching rules for any user', async () => {
      await seedFlag(prisma, ws.production.id, {
        key: 'dark-mode',
        isEnabled: false,
        percentageRollout: 100,
        targetingRules: [
          { attribute: 'plan', operator: 'EQUALS', values: ['enterprise'], value: true },
        ],
      });

      for (const userId of ['usr_1', 'usr_2', 'usr_1001', undefined]) {
        const res = await evaluate({
          flagKey: 'dark-mode',
          userId,
          attributes: { plan: 'enterprise' },
        });
        expect(res.body).toEqual({ flagKey: 'dark-mode', value: false, reason: 'DISABLED' });
      }
    });
  });
});
