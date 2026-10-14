import type { TargetingRule } from '@flagforge/shared';
import { bucket } from './bucket';
import { evaluate, type FlagSnapshot } from './evaluate';

const flag = (overrides: Partial<FlagSnapshot> = {}): FlagSnapshot => ({
  key: 'new-checkout',
  isEnabled: true,
  percentageRollout: 0,
  targetingRules: [],
  ...overrides,
});

const enterpriseRule: TargetingRule = {
  attribute: 'plan',
  operator: 'EQUALS',
  values: ['enterprise'],
  value: true,
};

describe('evaluate', () => {
  describe('master switch', () => {
    it('FR-21: returns DISABLED when isEnabled is false', () => {
      expect(evaluate(flag({ isEnabled: false }), { userId: 'u1', attributes: {} })).toEqual({
        value: false,
        reason: 'DISABLED',
      });
    });

    it('FR-21: DISABLED wins over matching rules and 100% rollout (AC-03)', () => {
      const f = flag({
        key: 'dark-mode',
        isEnabled: false,
        percentageRollout: 100,
        targetingRules: [enterpriseRule],
      });
      expect(evaluate(f, { userId: 'any', attributes: { plan: 'enterprise' } })).toEqual({
        value: false,
        reason: 'DISABLED',
      });
    });
  });

  describe('targeting rules', () => {
    it('FR-21: returns the rule value on match (AC-02)', () => {
      const f = flag({ key: 'beta-dashboard', targetingRules: [enterpriseRule] });
      expect(evaluate(f, { userId: 'usr_99', attributes: { plan: 'enterprise' } })).toEqual({
        value: true,
        reason: 'TARGETING_MATCH',
      });
    });

    it('FR-21: a matching rule can force false even at 100% rollout', () => {
      const blockUA: TargetingRule = {
        attribute: 'country',
        operator: 'EQUALS',
        values: ['UA'],
        value: false,
      };
      const f = flag({ percentageRollout: 100, targetingRules: [blockUA] });
      expect(evaluate(f, { userId: 'u1', attributes: { country: 'UA' } })).toEqual({
        value: false,
        reason: 'TARGETING_MATCH',
      });
    });

    it('FR-21: the first matching rule wins', () => {
      const first: TargetingRule = { ...enterpriseRule, value: false };
      const second: TargetingRule = { ...enterpriseRule, value: true };
      const f = flag({ targetingRules: [first, second] });
      expect(evaluate(f, { userId: 'u1', attributes: { plan: 'enterprise' } }).value).toBe(false);
    });

    it('FR-21: rules match without a userId', () => {
      const f = flag({ targetingRules: [enterpriseRule] });
      expect(evaluate(f, { attributes: { plan: 'enterprise' } })).toEqual({
        value: true,
        reason: 'TARGETING_MATCH',
      });
    });

    it('FR-21: falls through to rollout when no rule matches', () => {
      const f = flag({ percentageRollout: 100, targetingRules: [enterpriseRule] });
      expect(evaluate(f, { userId: 'u1', attributes: { plan: 'free' } })).toEqual({
        value: true,
        reason: 'PERCENTAGE_ROLLOUT',
      });
    });
  });

  describe('missing userId', () => {
    it('FR-22: returns MISSING_USER_ID when userId is absent', () => {
      expect(evaluate(flag({ percentageRollout: 50 }), { attributes: {} })).toEqual({
        value: false,
        reason: 'MISSING_USER_ID',
      });
    });

    it('FR-22: treats an empty userId as missing', () => {
      expect(evaluate(flag({ percentageRollout: 50 }), { userId: '', attributes: {} })).toEqual({
        value: false,
        reason: 'MISSING_USER_ID',
      });
    });

    it('FR-22: returns MISSING_USER_ID even at 0% rollout (SRS §5 flowchart)', () => {
      expect(evaluate(flag({ percentageRollout: 0 }), { attributes: {} }).reason).toBe(
        'MISSING_USER_ID',
      );
    });
  });

  describe('percentage rollout', () => {
    it('FR-21: includes a user whose bucket is below the percentage (AC-01)', () => {
      // bucket('usr_1001', 'new-checkout') = 28 (pinned in bucket.spec.ts)
      const f = flag({ key: 'new-checkout', percentageRollout: 30 });
      expect(evaluate(f, { userId: 'usr_1001', attributes: {} })).toEqual({
        value: true,
        reason: 'PERCENTAGE_ROLLOUT',
      });
    });

    it('FR-21: returns DEFAULT when the bucket equals the percentage (AC-01 boundary)', () => {
      expect(bucket('usr_1001', 'new-checkout')).toBe(28);
      const f = flag({ key: 'new-checkout', percentageRollout: 28 });
      expect(evaluate(f, { userId: 'usr_1001', attributes: {} })).toEqual({
        value: false,
        reason: 'DEFAULT',
      });
    });

    it('FR-21: 0% includes nobody and 100% includes everybody', () => {
      for (let i = 0; i < 1000; i++) {
        const ctx = { userId: `user-${i}`, attributes: {} };
        expect(evaluate(flag({ percentageRollout: 0 }), ctx).value).toBe(false);
        expect(evaluate(flag({ percentageRollout: 100 }), ctx).value).toBe(true);
      }
    });

    it('ADR-0004: raising the percentage never removes already-included users', () => {
      for (let i = 0; i < 1000; i++) {
        const ctx = { userId: `user-${i}`, attributes: {} };
        if (evaluate(flag({ percentageRollout: 30 }), ctx).value) {
          expect(evaluate(flag({ percentageRollout: 50 }), ctx).value).toBe(true);
        }
      }
    });
  });

  describe('determinism', () => {
    it('NFR-02: 100 consecutive evaluations return identical results (AC-01)', () => {
      const f = flag({ key: 'new-checkout', percentageRollout: 30 });
      const ctx = { userId: 'usr_1001', attributes: {} };
      const first = evaluate(f, ctx);
      for (let i = 0; i < 100; i++) {
        expect(evaluate(f, ctx)).toEqual(first);
      }
    });

    it('FR-24: does not mutate the flag or the context', () => {
      const f = flag({ percentageRollout: 50, targetingRules: [enterpriseRule] });
      const ctx = { userId: 'u1', attributes: { plan: 'free' } };
      const snapshot = JSON.stringify([f, ctx]);
      evaluate(f, ctx);
      expect(JSON.stringify([f, ctx])).toBe(snapshot);
    });
  });
});
