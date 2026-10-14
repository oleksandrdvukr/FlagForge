import { Module } from '@nestjs/common';
import { ClockModule } from './common/clock/clock.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [ClockModule, PrismaModule, HealthModule],
})
export class AppModule {}
