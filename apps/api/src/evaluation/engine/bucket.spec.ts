import { bucket } from './bucket';

describe('bucket', () => {
  // Golden vectors computed independently with Python:
  //   int.from_bytes(hashlib.sha256(f"{userId}:{flagKey}".encode()).digest()[:4], "big") % 100
  // A failure here means the bucketing algorithm changed — a breaking change (ADR-0004).
  it.each([
    ['usr_1001', 'new-checkout', 28],
    ['usr_99211', 'new-checkout-flow', 5],
    ['usr_99', 'beta-dashboard', 51],
    ['user-1', 'dark-mode', 86],
    ['Користувач', 'flag-key', 90],
    ['a', 'abc', 12],
  ])('NFR-02: bucket(%p, %p) is pinned to %p', (userId, flagKey, expected) => {
    expect(bucket(userId, flagKey)).toBe(expected);
  });

  it('NFR-02: returns the same bucket on repeated calls', () => {
    const first = bucket('usr_42', 'some-flag');
    for (let i = 0; i < 1000; i++) {
      expect(bucket('usr_42', 'some-flag')).toBe(first);
    }
  });

  it('FR-21: always returns an integer in [0, 99]', () => {
    for (let i = 0; i < 10_000; i++) {
      const b = bucket(`user-${i}`, 'range-check');
      expect(Number.isInteger(b)).toBe(true);
      expect(b).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(100);
    }
  });

  it('FR-21: distributes users uniformly — 30% rollout includes 30% ± 2% of 10 000 users', () => {
    const users = 10_000;
    let included = 0;
    for (let i = 0; i < users; i++) {
      if (bucket(`user-${i}`, 'distribution-check') < 30) included++;
    }
    expect(included / users).toBeGreaterThanOrEqual(0.28);
    expect(included / users).toBeLessThanOrEqual(0.32);
  });

  it('ADR-0004: buckets of the same user are independent across flags', () => {
    const users = 10_000;
    let inBoth = 0;
    for (let i = 0; i < users; i++) {
      if (bucket(`user-${i}`, 'flag-a') < 50 && bucket(`user-${i}`, 'flag-b') < 50) inBoth++;
    }
    // Independent 50% rollouts overlap on ~25% of users, not ~50%.
    expect(inBoth / users).toBeGreaterThanOrEqual(0.23);
    expect(inBoth / users).toBeLessThanOrEqual(0.27);
  });
});
