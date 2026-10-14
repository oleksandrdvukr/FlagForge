import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { Response } from 'express';
import { CLOCK, type Clock } from '../common/clock/clock';
import type { SdkRequest } from './sdk-key.guard';
import { TokenBucketLimiter, type RateLimitConfig } from './token-bucket';

export const RATE_LIMIT_CONFIG = Symbol('RATE_LIMIT_CONFIG');

/** SEC-04: must run after {@link SdkKeyGuard}, which resolves the environment. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly limiter: TokenBucketLimiter;

  constructor(@Inject(RATE_LIMIT_CONFIG) config: RateLimitConfig, @Inject(CLOCK) clock: Clock) {
    this.limiter = new TokenBucketLimiter(config, clock);
  }

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const environmentId = http.getRequest<SdkRequest>().environment?.id;
    if (!environmentId) throw new Error('RateLimitGuard requires SdkKeyGuard to run first');

    const { allowed, retryAfterSeconds } = this.limiter.tryConsume(environmentId);
    if (allowed) return true;

    http.getResponse<Response>().setHeader('Retry-After', String(retryAfterSeconds));
    throw new HttpException('Rate limit exceeded', HttpStatus.TOO_MANY_REQUESTS);
  }
}
