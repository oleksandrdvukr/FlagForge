import {
  MAX_CONTEXT_ATTRIBUTES,
  MAX_TARGETING_RULES,
  evaluationRequestSchema,
  flagKeySchema,
  targetingRuleSchema,
  targetingRulesSchema,
} from './evaluation';

describe('flagKeySchema', () => {
  it.each(['abc', 'new-checkout-flow', 'beta_dashboard', 'a'.repeat(64)])(
    'FR-10: accepts valid key %p',
    (key) => {
      expect(flagKeySchema.safeParse(key).success).toBe(true);
    },
  );

  it.each(['ab', 'a'.repeat(65), 'New-Flow', 'has space', 'dot.key', ''])(
    'FR-10: rejects invalid key %p',
    (key) => {
      expect(flagKeySchema.safeParse(key).success).toBe(false);
    },
  );
});

describe('targetingRuleSchema', () => {
  const rule = { attribute: 'plan', operator: 'EQUALS', values: ['enterprise'], value: true };

  it('FR-23: accepts a valid rule', () => {
    expect(targetingRuleSchema.parse(rule)).toEqual(rule);
  });

  it('FR-23: rejects an unknown operator', () => {
    expect(targetingRuleSchema.safeParse({ ...rule, operator: 'LESS_THAN' }).success).toBe(false);
  });

  it('FR-23: rejects empty values', () => {
    expect(targetingRuleSchema.safeParse({ ...rule, values: [] }).success).toBe(false);
  });

  it('FR-23: rejects non-scalar values', () => {
    expect(targetingRuleSchema.safeParse({ ...rule, values: [{ a: 1 }] }).success).toBe(false);
  });

  it(`FR-10: rejects more than ${MAX_TARGETING_RULES} rules`, () => {
    const rules = Array.from({ length: MAX_TARGETING_RULES + 1 }, () => rule);
    expect(targetingRulesSchema.safeParse(rules).success).toBe(false);
  });
});

describe('evaluationRequestSchema', () => {
  it('FR-20: accepts the SRS example context', () => {
    const body = {
      flagKey: 'new-checkout-flow',
      userId: 'usr_99211',
      attributes: { plan: 'enterprise', country: 'UA' },
    };
    expect(evaluationRequestSchema.parse(body)).toEqual(body);
  });

  it('FR-22: userId is optional and attributes default to {}', () => {
    expect(evaluationRequestSchema.parse({ flagKey: 'abc' })).toEqual({
      flagKey: 'abc',
      attributes: {},
    });
  });

  it('SEC-03: rejects an empty userId', () => {
    expect(evaluationRequestSchema.safeParse({ flagKey: 'abc', userId: '' }).success).toBe(false);
  });

  it('SEC-03: rejects nested attribute values', () => {
    const body = { flagKey: 'abc', attributes: { plan: { tier: 'gold' } } };
    expect(evaluationRequestSchema.safeParse(body).success).toBe(false);
  });

  it(`SEC-03: rejects more than ${MAX_CONTEXT_ATTRIBUTES} attributes`, () => {
    const attributes = Object.fromEntries(
      Array.from({ length: MAX_CONTEXT_ATTRIBUTES + 1 }, (_, i) => [`a${i}`, i]),
    );
    expect(evaluationRequestSchema.safeParse({ flagKey: 'abc', attributes }).success).toBe(false);
  });
});
