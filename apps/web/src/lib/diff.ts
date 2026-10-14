import type { FlagDto } from '@flagforge/shared';

export interface FieldChange {
  field: string;
  before: unknown;
  after: unknown;
}

/** Fields an admin can change; timestamps are shown separately. */
const TRACKED: (keyof FlagDto)[] = [
  'name',
  'description',
  'isEnabled',
  'percentageRollout',
  'targetingRules',
];

/** FR-31: what changed between the audit entry's previous and new state. */
export function diffFlagStates(previous: FlagDto | null, next: FlagDto): FieldChange[] {
  return TRACKED.flatMap((field) => {
    const before = previous ? previous[field] : undefined;
    const after = next[field];
    return JSON.stringify(before) === JSON.stringify(after) ? [] : [{ field, before, after }];
  });
}
