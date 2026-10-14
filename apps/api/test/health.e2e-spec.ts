import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

describe('Health (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('NFR-03: GET /healthz returns 200 { status: "ok" }', async () => {
    await request(app.getHttpServer()).get('/healthz').expect(200, { status: 'ok' });
  });

  it('NFR-03: GET /readyz returns 200 { status: "ok" }', async () => {
    await request(app.getHttpServer()).get('/readyz').expect(200, { status: 'ok' });
  });

  it('NFR-03: health probes are not under the /api/v1 prefix', async () => {
    await request(app.getHttpServer()).get('/api/v1/healthz').expect(404);
  });
});
