import { Module } from '@nestjs/common';
import { ClockModule } from './common/clock/clock.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { EnvironmentsModule } from './environments/environments.module';
import { EvaluationModule } from './evaluation/evaluation.module';
import { HealthModule } from './health/health.module';
import { WorkspacesModule } from './workspaces/workspaces.module';

@Module({
  imports: [
    ClockModule,
    PrismaModule,
    HealthModule,
    WorkspacesModule,
    EnvironmentsModule,
    EvaluationModule,
  ],
})
export class AppModule {}
