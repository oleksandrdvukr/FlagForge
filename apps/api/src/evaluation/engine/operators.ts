import type { AttributeValue, TargetingRule } from '@flagforge/shared';

type Attributes = Readonly<Record<string, AttributeValue>>;

/**
 * FR-23, design §5.4: whether a rule matches the context attributes.
 * A rule on an attribute absent from the context never matches.
 */
export function matchesRule(rule: TargetingRule, attributes: Attributes): boolean {
  // Own properties only, so keys like "constructor" never resolve through the prototype.
  if (!Object.hasOwn(attributes, rule.attribute)) return false;
  const actual = attributes[rule.attribute] as AttributeValue;
  const [expected] = rule.values;

  switch (rule.operator) {
    case 'EQUALS':
      return actual === expected;
    case 'NOT_EQUALS':
      return actual !== expected;
    case 'IN':
      return rule.values.includes(actual);
    case 'CONTAINS':
      return typeof actual === 'string' && actual.includes(String(expected));
    case 'GREATER_THAN':
      return typeof actual === 'number' && actual > Number(expected);
  }
}
