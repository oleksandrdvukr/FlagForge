import { emptyDraft, parseDraft, toDraft, type RuleDraft } from './rules';

const draft = (overrides: Partial<RuleDraft>): RuleDraft => ({ ...emptyDraft(), ...overrides });

describe('parseDraft', () => {
  it('FR-23: builds a string EQUALS rule', () => {
    expect(parseDraft(draft({ attribute: ' plan ', valuesText: ' enterprise ' }))).toEqual({
      ok: true,
      rule: { attribute: 'plan', operator: 'EQUALS', values: ['enterprise'], value: true },
    });
  });

  it('FR-23: splits IN values on commas', () => {
    const result = parseDraft(
      draft({ attribute: 'country', operator: 'IN', valuesText: 'UA, PL,DE' }),
    );
    expect(result).toMatchObject({ ok: true, rule: { values: ['UA', 'PL', 'DE'] } });
  });

  it('FR-23: keeps commas literally for single-value operators', () => {
    const result = parseDraft(draft({ attribute: 'title', valuesText: 'Hello, world' }));
    expect(result).toMatchObject({ ok: true, rule: { values: ['Hello, world'] } });
  });

  it('FR-23: parses typed numbers and booleans (the engine compares strictly)', () => {
    expect(
      parseDraft(draft({ attribute: 'seats', valueType: 'number', valuesText: '5' })),
    ).toMatchObject({
      rule: { values: [5] },
    });
    expect(
      parseDraft(draft({ attribute: 'beta', valueType: 'boolean', valuesText: 'true' })),
    ).toMatchObject({
      rule: { values: [true] },
    });
  });

  it('FR-23: GREATER_THAN always parses numbers, CONTAINS always strings', () => {
    expect(
      parseDraft(
        draft({
          attribute: 'seats',
          operator: 'GREATER_THAN',
          valueType: 'string',
          valuesText: '100',
        }),
      ),
    ).toMatchObject({ rule: { values: [100] } });
    expect(
      parseDraft(
        draft({ attribute: 'email', operator: 'CONTAINS', valueType: 'number', valuesText: '123' }),
      ),
    ).toMatchObject({ rule: { values: ['123'] } });
  });

  it.each([
    [draft({ attribute: '', valuesText: 'x' }), 'Enter an attribute name, e.g. plan'],
    [draft({ attribute: 'plan', valuesText: '  ' }), 'Enter a value'],
    [
      draft({ attribute: 'c', operator: 'IN', valuesText: 'UA,,PL' }),
      'Enter at least one value; separate values with commas',
    ],
    [
      draft({ attribute: 'seats', valueType: 'number', valuesText: 'ten' }),
      '"ten" is not a number',
    ],
    [
      draft({ attribute: 'beta', valueType: 'boolean', valuesText: 'yes' }),
      '"yes" is not true or false',
    ],
  ])('explains what to fix (%#)', (input, error) => {
    expect(parseDraft(input)).toEqual({ ok: false, error });
  });

  it('round-trips an existing rule through the editor', () => {
    const rule = { attribute: 'tier', operator: 'IN' as const, values: [1, 2, 3], value: false };
    expect(parseDraft(toDraft(rule))).toEqual({ ok: true, rule });
  });
});
