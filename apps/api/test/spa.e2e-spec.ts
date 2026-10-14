import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

// The Docker image serves the dashboard from the API process (ADR-0007). Other e2e suites run
// without a built SPA, so this one points WEB_DIST_PATH at a stub before the app is loaded.
// It boots through NestFactory like main.ts: in a TestingModule, @nestjs/serve-static picks its
// loader before the HTTP adapter exists and silently serves nothing.
const webDist = mkdtempSync(join(tmpdir(), 'flagforge-web-'));
writeFileSync(join(webDist, 'index.html'), '<!doctype html><title>FlagForge</title>');
process.env.WEB_DIST_PATH = webDist;

describe('API with the dashboard served (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const { AppModule } = await import('../src/app.module');
    const { APP_OPTIONS, configureApp } = await import('../src/configure-app');
    app = configureApp(
      await NestFactory.create<NestExpressApplication>(AppModule, {
        ...APP_OPTIONS,
        logger: false,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    rmSync(webDist, { recursive: true, force: true });
  });

  it('ADR-0007: dashboard routes fall back to index.html', async () => {
    const res = await request(app.getHttpServer()).get('/w/some-workspace/flags').expect(200);
    expect(res.text).toContain('<title>FlagForge</title>');
  });

  it('ADR-0007: unknown API paths stay JSON 404s', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/nope').expect(404);
    expect(res.body).toMatchObject({ statusCode: 404, error: 'Not Found' });
  });

  it('SEC-03: malformed JSON on the evaluation API returns 400, not 404', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/evaluate')
      .set('Content-Type', 'application/json')
      .send('{bad')
      .expect(400);
    expect(res.body).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Malformed JSON body',
    });
  });

  it('SEC-03: malformed JSON on the management API returns 400, not 404', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":')
      .expect(400);
  });

  it('SEC-03: a body over 100 kB returns 413', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/evaluate')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ flagKey: 'x'.repeat(101 * 1024) }))
      .expect(413);
    expect(res.body).toMatchObject({ statusCode: 413, message: 'Request body too large' });
  });

  it('sets security headers on dashboard and API responses', async () => {
    for (const path of ['/', '/api/v1/nope']) {
      const res = await request(app.getHttpServer()).get(path);
      expect(res.headers['x-powered-by']).toBeUndefined();
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['referrer-policy']).toBe('no-referrer');
      expect(res.headers['content-security-policy']).toContain("frame-ancestors 'none'");
    }
  });
});
