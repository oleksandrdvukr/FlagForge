import {
  createFlagRequestSchema,
  listAuditLogsQuerySchema,
  listFlagsQuerySchema,
  loginRequestSchema,
  updateFlagRequestSchema,
} from './flags';

describe('loginRequestSchema', () => {
  it('FR-32: requires a valid email and a password', () => {
    expect(loginRequestSchema.safeParse({ email: 'a@b.co', password: 'x' }).success).toBe(true);
    expect(loginRequestSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false);
    expect(loginRequestSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });
});

describe('createFlagRequestSchema', () => {
  it('FR-10: applies defaults — disabled, 0%, no rules', () => {
    expect(createFlagRequestSchema.parse({ key: 'new-flow', name: ' New flow ' })).toEqual({
      key: 'new-flow',
      name: 'New flow',
      isEnabled: false,
      percentageRollout: 0,
      targetingRules: [],
    });
  });

  it.each([
    [{ key: 'new-flow', name: '' }],
    [{ key: 'new-flow', name: 'x'.repeat(101) }],
    [{ key: 'new-flow', name: 'x', description: 'd'.repeat(501) }],
    [{ key: 'new-flow', name: 'x', percentageRollout: 101 }],
    [{ key: 'new-flow', name: 'x', percentageRollout: 12.5 }],
    [{ key: 'NO', name: 'x' }],
    [{ key: 'new-flow', name: 'x', unknownField: true }],
  ])('FR-10: rejects %p', (body) => {
    expect(createFlagRequestSchema.safeParse(body).success).toBe(false);
  });
});

describe('updateFlagRequestSchema', () => {
  it('FR-12: accepts a partial update', () => {
    expect(updateFlagRequestSchema.parse({ isEnabled: true })).toEqual({ isEnabled: true });
  });

  it('FR-12: rejects an empty body', () => {
    expect(updateFlagRequestSchema.safeParse({}).success).toBe(false);
  });

  it('FR-12: rejects attempts to change immutable fields like key', () => {
    expect(updateFlagRequestSchema.safeParse({ key: 'other' }).success).toBe(false);
  });
});

describe('list query schemas', () => {
  it('FR-11: coerces pagination from query strings with defaults', () => {
    expect(listFlagsQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
    expect(listFlagsQuerySchema.parse({ page: '3', pageSize: '50', q: ' chk ' })).toEqual({
      page: 3,
      pageSize: 50,
      q: 'chk',
    });
  });

  it.each([{ page: '0' }, { pageSize: '101' }, { page: 'abc' }])(
    'FR-11: rejects invalid pagination %p',
    (query) => {
      expect(listFlagsQuerySchema.safeParse(query).success).toBe(false);
    },
  );

  it('FR-31: validates the flagId filter as a UUID', () => {
    expect(listAuditLogsQuerySchema.safeParse({ flagId: 'nope' }).success).toBe(false);
  });
});
