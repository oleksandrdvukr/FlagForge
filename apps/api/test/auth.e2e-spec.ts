import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { CLOCK, FakeClock } from '../src/common/clock/clock';
import { TEST_ADMIN, loginCookie } from './utils/auth';
import { createTestApp } from './utils/create-test-app';

describe('Admin authentication (e2e)', () => {
  let app: INestApplication;
  const clock = new FakeClock('2026-10-14T10:00:00.000Z');

  beforeAll(async () => {
    app = await createTestApp((b) => b.overrideProvider(CLOCK).useValue(clock));
  });

  afterAll(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());

  describe('POST /api/v1/auth/login', () => {
    it('FR-32, SEC-02: sets an HttpOnly, SameSite=Lax, 12 h session cookie', async () => {
      const res = await http().post('/api/v1/auth/login').send(TEST_ADMIN).expect(204);
      const cookie = (res.headers['set-cookie'] as unknown as string[])[0]!;

      expect(cookie).toMatch(/^ff_session=[\w-]+\.[\w-]+\.[\w-]+;/);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('SameSite=Lax');
      expect(cookie).toContain('Max-Age=43200');
      expect(cookie).toContain('Path=/');
      expect(cookie).not.toContain('Secure'); // NODE_ENV=test; on in production
    });

    it('FR-32: accepts the email case-insensitively', async () => {
      await http()
        .post('/api/v1/auth/login')
        .send({ ...TEST_ADMIN, email: TEST_ADMIN.email.toUpperCase() })
        .expect(204);
    });

    it.each([
      ['wrong password', { email: TEST_ADMIN.email, password: 'wrong' }],
      ['unknown email', { email: 'someone@else.test', password: TEST_ADMIN.password }],
    ])('FR-32: rejects %s with the same generic 401', async (_case, body) => {
      const res = await http().post('/api/v1/auth/login').send(body).expect(401);
      expect(res.body).toEqual({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid email or password',
      });
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('SEC-03: validates the body', async () => {
      await http().post('/api/v1/auth/login').send({ email: 'not-an-email' }).expect(400);
    });
  });

  describe('session', () => {
    it('SEC-02: a session is valid just before 12 h and expired at 12 h', async () => {
      clock.set('2026-10-14T10:00:00.000Z');
      const cookie = await loginCookie(app);

      clock.set('2026-10-14T21:59:59.000Z');
      await http().get('/api/v1/workspaces').set('Cookie', cookie).expect(200);

      clock.set('2026-10-14T22:00:00.000Z');
      await http().get('/api/v1/workspaces').set('Cookie', cookie).expect(401);
    });

    it('FR-32: rejects a tampered token', async () => {
      clock.set('2026-10-14T10:00:00.000Z');
      const cookie = await loginCookie(app);
      // Flip the first signature character (the last one may only carry base64 padding bits).
      const [header, payload, signature] = cookie.replace('ff_session=', '').split('.');
      const flipped = (signature![0] === 'A' ? 'B' : 'A') + signature!.slice(1);
      const tampered = `ff_session=${header}.${payload}.${flipped}`;
      await http().get('/api/v1/workspaces').set('Cookie', tampered).expect(401);
    });

    it('FR-32: rejects a token signed with another secret', async () => {
      const forged =
        'ff_session=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
        'eyJzdWIiOiJhZG1pbkBmbGFnZm9yZ2UudGVzdCIsImlhdCI6MTc2MDQzNjAwMCwiZXhwIjo0MTAyNDQ0ODAwfQ.' +
        'c2lnbmVkLXdpdGgtYW5vdGhlci1zZWNyZXQ';
      await http().get('/api/v1/workspaces').set('Cookie', forged).expect(401);
    });

    it('FR-32: logout clears the cookie', async () => {
      const res = await http().post('/api/v1/auth/logout').expect(204);
      const cookie = (res.headers['set-cookie'] as unknown as string[])[0]!;
      expect(cookie).toMatch(/^ff_session=;/);
      expect(cookie).toContain('Expires=Thu, 01 Jan 1970');
    });
  });

  describe('route protection (deny by default)', () => {
    const id = randomUUID();
    it.each([
      ['GET', '/api/v1/workspaces'],
      ['POST', '/api/v1/workspaces'],
      ['GET', `/api/v1/workspaces/${id}/environments`],
      ['POST', `/api/v1/environments/${id}/sdk-key/rotate`],
      ['GET', `/api/v1/environments/${id}/flags`],
      ['POST', `/api/v1/environments/${id}/flags`],
      ['GET', `/api/v1/flags/${id}`],
      ['PATCH', `/api/v1/flags/${id}`],
      ['DELETE', `/api/v1/flags/${id}`],
      ['GET', `/api/v1/environments/${id}/audit-logs`],
    ])('FR-32: %s %s requires a session', async (method, url) => {
      const res = await http()[method.toLowerCase() as 'get'](url).expect(401);
      expect(res.body).toMatchObject({ message: 'Authentication required' });
    });

    it.each([
      ['GET', '/healthz', 200],
      ['GET', '/readyz', 200],
      ['POST', '/api/v1/evaluate', 401], // public route, but needs an SDK key (FR-33)
    ])('%s %s stays reachable without a session', async (method, url, status) => {
      const res = await http()[method.toLowerCase() as 'get'](url);
      expect(res.status).toBe(status);
      expect(res.body).not.toMatchObject({ message: 'Authentication required' });
    });
  });
});
