import { Controller, Get } from '@nestjs/common';

export interface HealthResponse {
  status: 'ok' | 'error';
}

@Controller()
export class HealthController {
  /** NFR-03: liveness, never touches the database. */
  @Get('healthz')
  healthz(): HealthResponse {
    return { status: 'ok' };
  }

  /** NFR-03: readiness. Database ping is added with PrismaModule in phase 3. */
  @Get('readyz')
  readyz(): HealthResponse {
    return { status: 'ok' };
  }
}
