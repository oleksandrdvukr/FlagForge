import { bucket } from './bucket';

describe('bucket (browser port)', () => {
  // Same golden vectors as the server (apps/api/src/evaluation/engine/bucket.spec.ts).
  it.each([
    ['usr_1001', 'new-checkout', 28],
    ['usr_99211', 'new-checkout-flow', 5],
    ['usr_99', 'beta-dashboard', 51],
    ['user-1', 'dark-mode', 86],
    ['Користувач', 'flag-key', 90],
    ['a', 'abc', 12],
  ])('ADR-0004: bucket(%p, %p) matches the server: %p', async (userId, flagKey, expected) => {
    await expect(bucket(userId, flagKey)).resolves.toBe(expected);
  });
});
