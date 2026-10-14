import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { configureApp } from '../src/configure-app';

async function createApp(prismaOverride?: Partial<PrismaService>): Promise<INestApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (prismaOverride) builder = builder.overrideProvider(PrismaService).useValue(prismaOverride);
  const app = configureApp((await builder.compile()).createNestApplication());
  await app.init();
  return app;
}

describe('Health (e2e)', () => {
  describe('with the database up', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await createApp();
    });

    afterAll(async () => {
      await app.close();
    });

    it('NFR-03: GET /healthz returns 200 { status: "ok" }', async () => {
      await request(app.getHttpServer()).get('/healthz').expect(200, { status: 'ok' });
    });

    it('NFR-03: GET /readyz returns 200 when PostgreSQL answers', async () => {
      await request(app.getHttpServer()).get('/readyz').expect(200, { status: 'ok' });
    });

    it('NFR-03: health probes are not under the /api/v1 prefix', async () => {
      await request(app.getHttpServer()).get('/api/v1/healthz').expect(404);
    });
  });

  describe('with the database down', () => {
    let app: INestApplication;

    beforeAll(async () => {
      app = await createApp({
        $queryRaw: jest.fn().mockRejectedValue(new Error('connection refused')),
        $disconnect: jest.fn(),
      } as unknown as Partial<PrismaService>);
    });

    afterAll(async () => {
      await app.close();
    });

    it('NFR-03: GET /readyz returns 503 { status: "error" }', async () => {
      await request(app.getHttpServer()).get('/readyz').expect(503, { status: 'error' });
    });

    it('NFR-03: GET /healthz still returns 200 (liveness does not depend on the DB)', async () => {
      await request(app.getHttpServer()).get('/healthz').expect(200, { status: 'ok' });
    });
  });
});
