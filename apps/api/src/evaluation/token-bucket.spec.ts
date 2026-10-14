import { FakeClock } from '../common/clock/clock';
import { DEFAULT_RATE_LIMIT, TokenBucketLimiter } from './token-bucket';

describe('TokenBucketLimiter', () => {
  it('SEC-04: allows 1000 requests per minute per key, then rejects', () => {
    const limiter = new TokenBucketLimiter(DEFAULT_RATE_LIMIT, new FakeClock());
    for (let i = 0; i < 1000; i++) {
      expect(limiter.tryConsume('env-a').allowed).toBe(true);
    }
    expect(limiter.tryConsume('env-a')).toEqual({ allowed: false, retryAfterSeconds: 1 });
  });

  it('SEC-04: refills at 1000/60 tokens per second', () => {
    const clock = new FakeClock();
    const limiter = new TokenBucketLimiter(DEFAULT_RATE_LIMIT, clock);
    for (let i = 0; i < 1000; i++) limiter.tryConsume('env-a');

    clock.advance(3000); // 3 s → 50 tokens
    for (let i = 0; i < 50; i++) {
      expect(limiter.tryConsume('env-a').allowed).toBe(true);
    }
    expect(limiter.tryConsume('env-a').allowed).toBe(false);
  });

  it('SEC-04: a full minute restores the full capacity, never more', () => {
    const clock = new FakeClock();
    const limiter = new TokenBucketLimiter(DEFAULT_RATE_LIMIT, clock);
    for (let i = 0; i < 1000; i++) limiter.tryConsume('env-a');

    clock.advance(10 * 60_000); // 10 minutes idle
    let allowed = 0;
    while (limiter.tryConsume('env-a').allowed) allowed++;
    expect(allowed).toBe(1000);
  });

  it('SEC-04: keys are limited independently', () => {
    const limiter = new TokenBucketLimiter({ capacity: 1, refillPerSecond: 1 }, new FakeClock());
    expect(limiter.tryConsume('env-a').allowed).toBe(true);
    expect(limiter.tryConsume('env-a').allowed).toBe(false);
    expect(limiter.tryConsume('env-b').allowed).toBe(true);
  });

  it('SEC-04: reports Retry-After rounded up to whole seconds', () => {
    const limiter = new TokenBucketLimiter({ capacity: 1, refillPerSecond: 0.25 }, new FakeClock());
    limiter.tryConsume('env-a');
    expect(limiter.tryConsume('env-a')).toEqual({ allowed: false, retryAfterSeconds: 4 });
  });

  it('ignores a clock moving backwards instead of minting tokens', () => {
    const clock = new FakeClock('2026-10-14T10:00:00.000Z');
    const limiter = new TokenBucketLimiter({ capacity: 1, refillPerSecond: 1 }, clock);
    limiter.tryConsume('env-a');
    clock.set('2026-10-14T09:00:00.000Z');
    expect(limiter.tryConsume('env-a').allowed).toBe(false);
  });
});
