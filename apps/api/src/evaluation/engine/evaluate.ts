import type { AttributeValue, EvaluationReason, TargetingRule } from '@flagforge/shared';
import { bucket } from './bucket';
import { matchesRule } from './operators';

/** The subset of a flag the engine needs. */
export interface FlagSnapshot {
  readonly key: string;
  readonly isEnabled: boolean;
  readonly percentageRollout: number;
  readonly targetingRules: readonly TargetingRule[];
}

export interface EvaluationContext {
  readonly userId?: string;
  readonly attributes: Readonly<Record<string, AttributeValue>>;
}

export interface EvaluationResult {
  readonly value: boolean;
  readonly reason: EvaluationReason;
}

/**
 * FR-21, FR-22, FR-24: pure, deterministic flag evaluation (design §5.2).
 * No I/O, no clock, no randomness — identical inputs always give identical results (NFR-02).
 */
export function evaluate(flag: FlagSnapshot, context: EvaluationContext): EvaluationResult {
  if (!flag.isEnabled) {
    return { value: false, reason: 'DISABLED' };
  }

  const rule = flag.targetingRules.find((r) => matchesRule(r, context.attributes));
  if (rule) {
    return { value: rule.value, reason: 'TARGETING_MATCH' };
  }

  if (!context.userId) {
    return { value: false, reason: 'MISSING_USER_ID' };
  }

  if (bucket(context.userId, flag.key) < flag.percentageRollout) {
    return { value: true, reason: 'PERCENTAGE_ROLLOUT' };
  }

  return { value: false, reason: 'DEFAULT' };
}
