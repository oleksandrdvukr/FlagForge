import { INestApplication } from '@nestjs/common';
import request from 'supertest';

export const TEST_ADMIN = { email: 'admin@flagforge.test', password: 'test-password' } as const;

/** Logs in as the test admin and returns the `Cookie` header value for later requests. */
export async function loginCookie(app: INestApplication): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send(TEST_ADMIN)
    .expect(204);
  const setCookie = res.headers['set-cookie'] as unknown as string[];
  return setCookie.map((c) => c.split(';')[0]).join('; ');
}
