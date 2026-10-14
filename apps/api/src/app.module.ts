import { Module } from '@nestjs/common';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { ClockModule } from './common/clock/clock.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { EnvironmentsModule } from './environments/environments.module';
import { EvaluationModule } from './evaluation/evaluation.module';
import { FlagsModule } from './flags/flags.module';
import { HealthModule } from './health/health.module';
import { WorkspacesModule } from './workspaces/workspaces.module';

@Module({
  imports: [
    ClockModule,
    PrismaModule,
    AuthModule,
    HealthModule,
    WorkspacesModule,
    EnvironmentsModule,
    EvaluationModule,
    FlagsModule,
    AuditModule,
  ],
})
export class AppModule {}
