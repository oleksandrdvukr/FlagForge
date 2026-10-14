import { Module } from '@nestjs/common';
import { EnvironmentsModule } from '../environments/environments.module';
import { EvaluationController } from './evaluation.controller';
import { EvaluationService } from './evaluation.service';
import { RATE_LIMIT_CONFIG, RateLimitGuard } from './rate-limit.guard';
import { SdkKeyGuard } from './sdk-key.guard';
import { rateLimitFromEnv } from './token-bucket';

@Module({
  imports: [EnvironmentsModule],
  controllers: [EvaluationController],
  providers: [
    EvaluationService,
    SdkKeyGuard,
    RateLimitGuard,
    { provide: RATE_LIMIT_CONFIG, useFactory: () => rateLimitFromEnv() },
  ],
})
export class EvaluationModule {}
