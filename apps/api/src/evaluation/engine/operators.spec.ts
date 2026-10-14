import type { AttributeValue, TargetingOperator, TargetingRule } from '@flagforge/shared';
import { matchesRule } from './operators';

const rule = (
  attribute: string,
  operator: TargetingOperator,
  values: AttributeValue[],
): TargetingRule => ({ attribute, operator, values, value: true });

describe('matchesRule', () => {
  describe('EQUALS', () => {
    it('FR-23: matches an equal string', () => {
      expect(matchesRule(rule('plan', 'EQUALS', ['enterprise']), { plan: 'enterprise' })).toBe(
        true,
      );
    });

    it('FR-23: does not match a different string', () => {
      expect(matchesRule(rule('plan', 'EQUALS', ['enterprise']), { plan: 'free' })).toBe(false);
    });

    it('FR-23: is case-sensitive', () => {
      expect(matchesRule(rule('plan', 'EQUALS', ['enterprise']), { plan: 'Enterprise' })).toBe(
        false,
      );
    });

    it('FR-23: does not coerce types (5 !== "5")', () => {
      expect(matchesRule(rule('seats', 'EQUALS', ['5']), { seats: 5 })).toBe(false);
    });

    it('FR-23: matches numbers and booleans', () => {
      expect(matchesRule(rule('seats', 'EQUALS', [5]), { seats: 5 })).toBe(true);
      expect(matchesRule(rule('beta', 'EQUALS', [true]), { beta: true })).toBe(true);
    });
  });

  describe('NOT_EQUALS', () => {
    it('FR-23: matches a different value', () => {
      expect(matchesRule(rule('country', 'NOT_EQUALS', ['UA']), { country: 'PL' })).toBe(true);
    });

    it('FR-23: does not match an equal value', () => {
      expect(matchesRule(rule('country', 'NOT_EQUALS', ['UA']), { country: 'UA' })).toBe(false);
    });

    it('FR-23: does not match when the attribute is missing', () => {
      expect(matchesRule(rule('country', 'NOT_EQUALS', ['UA']), {})).toBe(false);
    });
  });

  describe('IN', () => {
    it('FR-23: matches when the value is in the list', () => {
      expect(matchesRule(rule('country', 'IN', ['UA', 'PL', 'DE']), { country: 'PL' })).toBe(true);
    });

    it('FR-23: does not match when the value is not in the list', () => {
      expect(matchesRule(rule('country', 'IN', ['UA', 'PL']), { country: 'US' })).toBe(false);
    });

    it('FR-23: does not coerce types', () => {
      expect(matchesRule(rule('tier', 'IN', ['1', '2']), { tier: 1 })).toBe(false);
    });
  });

  describe('CONTAINS', () => {
    it('FR-23: matches a substring', () => {
      expect(
        matchesRule(rule('email', 'CONTAINS', ['@acme.com']), { email: 'jane@acme.com' }),
      ).toBe(true);
    });

    it('FR-23: does not match a missing substring', () => {
      expect(
        matchesRule(rule('email', 'CONTAINS', ['@acme.com']), { email: 'jane@other.io' }),
      ).toBe(false);
    });

    it('FR-23: is case-sensitive', () => {
      expect(
        matchesRule(rule('email', 'CONTAINS', ['@ACME.com']), { email: 'jane@acme.com' }),
      ).toBe(false);
    });

    it('FR-23: never matches a non-string attribute', () => {
      expect(matchesRule(rule('seats', 'CONTAINS', ['1']), { seats: 10 })).toBe(false);
    });
  });

  describe('GREATER_THAN', () => {
    it('FR-23: matches a greater number', () => {
      expect(matchesRule(rule('seats', 'GREATER_THAN', [100]), { seats: 101 })).toBe(true);
    });

    it('FR-23: does not match an equal number', () => {
      expect(matchesRule(rule('seats', 'GREATER_THAN', [100]), { seats: 100 })).toBe(false);
    });

    it('FR-23: accepts a numeric string operand', () => {
      expect(matchesRule(rule('seats', 'GREATER_THAN', ['100']), { seats: 150 })).toBe(true);
    });

    it('FR-23: never matches a non-numeric operand', () => {
      expect(matchesRule(rule('seats', 'GREATER_THAN', ['many']), { seats: 150 })).toBe(false);
    });

    it('FR-23: never matches a non-number attribute', () => {
      expect(matchesRule(rule('seats', 'GREATER_THAN', [100]), { seats: '150' })).toBe(false);
    });
  });

  describe('missing attributes', () => {
    it.each<TargetingOperator>(['EQUALS', 'NOT_EQUALS', 'IN', 'CONTAINS', 'GREATER_THAN'])(
      'FR-23: %s never matches an attribute absent from the context',
      (operator) => {
        expect(matchesRule(rule('plan', operator, ['x']), { country: 'UA' })).toBe(false);
      },
    );

    it('FR-23: ignores inherited properties such as "constructor"', () => {
      expect(matchesRule(rule('constructor', 'NOT_EQUALS', ['x']), {})).toBe(false);
    });
  });
});
