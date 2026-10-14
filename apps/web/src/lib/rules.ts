import type { AttributeValue, TargetingOperator, TargetingRule } from '@flagforge/shared';

/** Values are typed strictly by the engine (5 !== "5"), so the editor makes the type explicit. */
export type ValueType = 'string' | 'number' | 'boolean';

/** Editable form of a rule: values as the text the user typed. */
export interface RuleDraft {
  attribute: string;
  operator: TargetingOperator;
  valueType: ValueType;
  valuesText: string;
  value: boolean;
}

export const OPERATOR_LABELS: Record<TargetingOperator, string> = {
  EQUALS: 'equals',
  NOT_EQUALS: 'does not equal',
  IN: 'is one of',
  CONTAINS: 'contains',
  GREATER_THAN: 'is greater than',
};

/** Operators that compare against several values; the rest use only the first. */
export const isListOperator = (op: TargetingOperator) => op === 'IN';

/** Operators that only make sense for one value type. */
export const forcedValueType = (op: TargetingOperator): ValueType | null =>
  op === 'CONTAINS' ? 'string' : op === 'GREATER_THAN' ? 'number' : null;

export function inferValueType(values: AttributeValue[]): ValueType {
  const first = values[0];
  return typeof first === 'number' ? 'number' : typeof first === 'boolean' ? 'boolean' : 'string';
}

export function toDraft(rule: TargetingRule): RuleDraft {
  return {
    attribute: rule.attribute,
    operator: rule.operator,
    valueType: inferValueType(rule.values),
    valuesText: rule.values.map(String).join(', '),
    value: rule.value,
  };
}

export const emptyDraft = (): RuleDraft => ({
  attribute: '',
  operator: 'EQUALS',
  valueType: 'string',
  valuesText: '',
  value: true,
});

export type ParseResult = { ok: true; rule: TargetingRule } | { ok: false; error: string };

/** Turns a draft into a rule the API accepts, or explains what to fix. */
export function parseDraft(draft: RuleDraft): ParseResult {
  const attribute = draft.attribute.trim();
  if (!attribute) return { ok: false, error: 'Enter an attribute name, e.g. plan' };

  const type = forcedValueType(draft.operator) ?? draft.valueType;
  const tokens = isListOperator(draft.operator)
    ? draft.valuesText.split(',').map((t) => t.trim())
    : [draft.valuesText.trim()];
  if (tokens.some((t) => t === '')) {
    return {
      ok: false,
      error: isListOperator(draft.operator)
        ? 'Enter at least one value; separate values with commas'
        : 'Enter a value',
    };
  }

  const values: AttributeValue[] = [];
  for (const token of tokens) {
    if (type === 'number') {
      const n = Number(token);
      if (!Number.isFinite(n)) return { ok: false, error: `"${token}" is not a number` };
      values.push(n);
    } else if (type === 'boolean') {
      if (token !== 'true' && token !== 'false') {
        return { ok: false, error: `"${token}" is not true or false` };
      }
      values.push(token === 'true');
    } else {
      values.push(token);
    }
  }
  return { ok: true, rule: { attribute, operator: draft.operator, values, value: draft.value } };
}
