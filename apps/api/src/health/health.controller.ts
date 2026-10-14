import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { PrismaService } from '../common/prisma/prisma.service';

export interface HealthResponse {
  status: 'ok' | 'error';
}

@Controller()
@Public()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** NFR-03: liveness, never touches the database. */
  @Get('healthz')
  healthz(): HealthResponse {
    return { status: 'ok' };
  }

  /** NFR-03: readiness — 200 when PostgreSQL answers, 503 otherwise. */
  @Get('readyz')
  @HttpCode(HttpStatus.OK)
  async readyz(@Res({ passthrough: true }) res: Response): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { status: 'ok' };
    } catch {
      res.status(HttpStatus.SERVICE_UNAVAILABLE);
      return { status: 'error' };
    }
  }
}
