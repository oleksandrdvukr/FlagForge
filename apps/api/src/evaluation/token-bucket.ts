import type { Clock } from '../common/clock/clock';

export interface RateLimitConfig {
  /** Maximum burst size. */
  capacity: number;
  /** Tokens added per second. */
  refillPerSecond: number;
}

/** SEC-04: 1000 requests per minute per SDK key. */
export const DEFAULT_RATE_LIMIT: RateLimitConfig = { capacity: 1000, refillPerSecond: 1000 / 60 };

export interface ConsumeResult {
  allowed: boolean;
  /** Whole seconds until the next token is available (0 when allowed). */
  retryAfterSeconds: number;
}

interface Bucket {
  tokens: number;
  updatedAt: number;
}

/**
 * ADR-0005: in-memory token bucket per key. State is only a token count and a timestamp
 * per environment — no client context is stored (NFR-04).
 */
export class TokenBucketLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly config: RateLimitConfig,
    private readonly clock: Clock,
  ) {}

  tryConsume(key: string): ConsumeResult {
    const now = this.clock.now().getTime();
    const bucket = this.buckets.get(key) ?? { tokens: this.config.capacity, updatedAt: now };

    const elapsedSeconds = Math.max(0, now - bucket.updatedAt) / 1000;
    bucket.tokens = Math.min(
      this.config.capacity,
      bucket.tokens + elapsedSeconds * this.config.refillPerSecond,
    );
    bucket.updatedAt = now;
    this.buckets.set(key, bucket);

    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return { allowed: true, retryAfterSeconds: 0 };
    }
    const secondsToNextToken = (1 - bucket.tokens) / this.config.refillPerSecond;
    return { allowed: false, retryAfterSeconds: Math.ceil(secondsToNextToken) };
  }
}
