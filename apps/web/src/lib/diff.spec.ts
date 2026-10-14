import type { FlagDto } from '@flagforge/shared';
import { diffFlagStates } from './diff';

const flag: FlagDto = {
  id: 'f1',
  environmentId: 'e1',
  key: 'new-checkout',
  name: 'New checkout',
  description: null,
  isEnabled: false,
  percentageRollout: 0,
  targetingRules: [],
  createdAt: '2026-10-14T10:00:00.000Z',
  updatedAt: '2026-10-14T10:00:00.000Z',
};

describe('diffFlagStates', () => {
  it('FR-31: lists only the fields that changed', () => {
    const next = {
      ...flag,
      isEnabled: true,
      percentageRollout: 30,
      updatedAt: '2026-10-14T11:00:00.000Z',
    };
    expect(diffFlagStates(flag, next)).toEqual([
      { field: 'isEnabled', before: false, after: true },
      { field: 'percentageRollout', before: 0, after: 30 },
    ]);
  });

  it('FR-31: detects changes inside targeting rules', () => {
    const next = {
      ...flag,
      targetingRules: [
        { attribute: 'plan', operator: 'EQUALS' as const, values: ['pro'], value: true },
      ],
    };
    expect(diffFlagStates(flag, next).map((c) => c.field)).toEqual(['targetingRules']);
  });

  it('FR-31: treats a created flag as a change from nothing', () => {
    expect(diffFlagStates(null, flag).map((c) => c.field)).toEqual([
      'name',
      'description',
      'isEnabled',
      'percentageRollout',
      'targetingRules',
    ]);
  });

  it('returns no changes for an archive that kept the configuration', () => {
    expect(diffFlagStates(flag, { ...flag, updatedAt: '2026-10-15T00:00:00.000Z' })).toEqual([]);
  });
});
