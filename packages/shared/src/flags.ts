import { z } from 'zod';
import { flagKeySchema, targetingRulesSchema, type TargetingRule } from './evaluation';

/** FR-32 */
export const loginRequestSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});
export type LoginRequest = z.infer<typeof loginRequestSchema>;

const percentageRolloutSchema = z.number().int().min(0).max(100);

/** FR-10. Unknown fields are rejected rather than silently dropped. */
export const createFlagRequestSchema = z.strictObject({
  key: flagKeySchema,
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).optional(),
  isEnabled: z.boolean().default(false),
  percentageRollout: percentageRolloutSchema.default(0),
  targetingRules: targetingRulesSchema.default([]),
});
export type CreateFlagRequest = z.infer<typeof createFlagRequestSchema>;

/** FR-12: partial update of the evaluation-relevant fields; `key` is immutable. */
export const updateFlagRequestSchema = z
  .strictObject({
    isEnabled: z.boolean(),
    percentageRollout: percentageRolloutSchema,
    targetingRules: targetingRulesSchema,
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, { message: 'At least one field is required' });
export type UpdateFlagRequest = z.infer<typeof updateFlagRequestSchema>;

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/** FR-11 */
export const listFlagsQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().max(100).optional(),
});
export type ListFlagsQuery = z.infer<typeof listFlagsQuerySchema>;

/** FR-30, FR-31 */
export const listAuditLogsQuerySchema = paginationQuerySchema.extend({
  flagId: z.uuid().optional(),
});
export type ListAuditLogsQuery = z.infer<typeof listAuditLogsQuerySchema>;

export interface FlagDto {
  id: string;
  environmentId: string;
  key: string;
  name: string;
  description: string | null;
  isEnabled: boolean;
  percentageRollout: number;
  targetingRules: TargetingRule[];
  createdAt: string;
  updatedAt: string;
  /** FR-13: `null` for active flags; set only in the `ARCHIVED` audit snapshot. */
  archivedAt: string | null;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

/** SRS §4.5: actions match the flag lifecycle. */
export const AUDIT_ACTIONS = ['CREATED', 'UPDATED', 'ARCHIVED'] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export interface AuditLogDto {
  /** bigint serialized as string. */
  id: string;
  environmentId: string;
  flagId: string;
  action: AuditAction;
  actorId: string;
  previousState: FlagDto | null;
  newState: FlagDto;
  timestamp: string;
}
