import { z } from 'zod';

/** FR-10: flag key slug. */
export const FLAG_KEY_PATTERN = /^[a-z0-9-_]{3,64}$/;

export const flagKeySchema = z.string().regex(FLAG_KEY_PATTERN, 'Must match ^[a-z0-9-_]{3,64}$');

/** Value of a context attribute or a targeting rule operand. */
export const attributeValueSchema = z.union([z.string(), z.number(), z.boolean()]);
export type AttributeValue = z.infer<typeof attributeValueSchema>;

/** FR-23: supported targeting rule operators. */
export const targetingOperatorSchema = z.enum([
  'EQUALS',
  'NOT_EQUALS',
  'IN',
  'CONTAINS',
  'GREATER_THAN',
]);
export type TargetingOperator = z.infer<typeof targetingOperatorSchema>;

/** FR-23, design §5.4: a single condition and the value returned when it matches. */
export const targetingRuleSchema = z.object({
  attribute: z.string().min(1).max(64),
  operator: targetingOperatorSchema,
  values: z.array(attributeValueSchema).min(1).max(100),
  value: z.boolean(),
});
export type TargetingRule = z.infer<typeof targetingRuleSchema>;

export const MAX_TARGETING_RULES = 50;
export const targetingRulesSchema = z.array(targetingRuleSchema).max(MAX_TARGETING_RULES);

export const MAX_CONTEXT_ATTRIBUTES = 50;

/** FR-20: Evaluation Context sent by client applications. */
export const evaluationRequestSchema = z.object({
  flagKey: flagKeySchema,
  userId: z.string().min(1).max(256).optional(),
  attributes: z
    .record(z.string(), attributeValueSchema)
    .refine((attrs) => Object.keys(attrs).length <= MAX_CONTEXT_ATTRIBUTES, {
      message: `At most ${MAX_CONTEXT_ATTRIBUTES} attributes are allowed`,
    })
    .default({}),
});
export type EvaluationRequest = z.infer<typeof evaluationRequestSchema>;

/** FR-21, FR-22: why a flag resolved to its value. */
export const evaluationReasonSchema = z.enum([
  'DISABLED',
  'TARGETING_MATCH',
  'PERCENTAGE_ROLLOUT',
  'MISSING_USER_ID',
  'DEFAULT',
]);
export type EvaluationReason = z.infer<typeof evaluationReasonSchema>;

export const evaluationResponseSchema = z.object({
  flagKey: z.string(),
  value: z.boolean(),
  reason: evaluationReasonSchema,
});
export type EvaluationResponse = z.infer<typeof evaluationResponseSchema>;
