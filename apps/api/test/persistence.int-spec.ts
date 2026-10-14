import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

/**
 * Integration tests for the physical data model (SRS §6) against a real PostgreSQL.
 * Rows are never cleaned up — audit logs cannot be deleted by design — so every test
 * works on its own freshly created workspace.
 */
describe('Persistence (integration)', () => {
  const prisma = new PrismaClient();

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function createEnvironment() {
    const workspace = await prisma.workspace.create({ data: { name: `ws-${randomUUID()}` } });
    return prisma.environment.create({
      data: { workspaceId: workspace.id, name: 'Development', sdkKeyHash: randomUUID() },
    });
  }

  async function createFlag(environmentId: string, key = 'new-checkout') {
    return prisma.featureFlag.create({ data: { environmentId, key, name: 'New checkout' } });
  }

  async function createAuditLog(environmentId: string, flagId: string) {
    return prisma.auditLog.create({
      data: {
        environmentId,
        flagId,
        action: 'CREATED',
        actorId: 'admin@example.com',
        newState: { key: 'new-checkout' },
        performedAt: new Date('2026-10-14T10:00:00.000Z'),
      },
    });
  }

  describe('feature_flags', () => {
    it('FR-10: applies defaults — disabled, 0% rollout, no rules, not archived', async () => {
      const env = await createEnvironment();
      const flag = await createFlag(env.id);
      expect(flag).toMatchObject({
        isEnabled: false,
        percentageRollout: 0,
        targetingRules: [],
        archivedAt: null,
      });
    });

    it('FR-10: rejects a duplicate key within the same environment', async () => {
      const env = await createEnvironment();
      await createFlag(env.id, 'dup-key');
      await expect(createFlag(env.id, 'dup-key')).rejects.toMatchObject({ code: 'P2002' });
    });

    it('FR-10: allows the same key in different environments', async () => {
      const [a, b] = await Promise.all([createEnvironment(), createEnvironment()]);
      await createFlag(a.id, 'shared-key');
      await expect(createFlag(b.id, 'shared-key')).resolves.toBeDefined();
    });

    it.each([-1, 101])(
      'FR-10: rejects percentageRollout = %p via CHECK constraint',
      async (pct) => {
        const env = await createEnvironment();
        await expect(
          prisma.featureFlag.create({
            data: { environmentId: env.id, key: `pct-${pct}`, name: 'x', percentageRollout: pct },
          }),
        ).rejects.toThrow(/feature_flags_percentage_rollout_range/);
      },
    );

    it.each(['ab', 'Upper-Case', 'has space'])(
      'FR-10: rejects key %p via CHECK constraint',
      async (key) => {
        const env = await createEnvironment();
        await expect(createFlag(env.id, key)).rejects.toThrow(/feature_flags_key_format/);
      },
    );
  });

  describe('environments', () => {
    it('SEC-01: sdk_key_hash is unique across environments', async () => {
      const env = await createEnvironment();
      const other = await prisma.workspace.create({ data: { name: `ws-${randomUUID()}` } });
      await expect(
        prisma.environment.create({
          data: { workspaceId: other.id, name: 'Development', sdkKeyHash: env.sdkKeyHash },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });

    it('FR-02: environment names are unique within a workspace', async () => {
      const env = await createEnvironment();
      await expect(
        prisma.environment.create({
          data: { workspaceId: env.workspaceId, name: 'Development', sdkKeyHash: randomUUID() },
        }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });
  });

  describe('audit_logs', () => {
    it('FR-30: accepts inserts', async () => {
      const env = await createEnvironment();
      const flag = await createFlag(env.id);
      const log = await createAuditLog(env.id, flag.id);
      expect(typeof log.id).toBe('bigint');
    });

    it('FR-30: rejects UPDATE via trigger', async () => {
      const env = await createEnvironment();
      const flag = await createFlag(env.id);
      const log = await createAuditLog(env.id, flag.id);
      await expect(
        prisma.auditLog.update({ where: { id: log.id }, data: { actorId: 'attacker' } }),
      ).rejects.toThrow(/append-only: UPDATE/);
    });

    it('FR-30: rejects DELETE via trigger', async () => {
      const env = await createEnvironment();
      const flag = await createFlag(env.id);
      const log = await createAuditLog(env.id, flag.id);
      await expect(prisma.auditLog.delete({ where: { id: log.id } })).rejects.toThrow(
        /append-only: DELETE/,
      );
    });

    it('FR-30: rejects TRUNCATE via trigger', async () => {
      await expect(prisma.$executeRawUnsafe('TRUNCATE audit_logs')).rejects.toThrow(
        /append-only: TRUNCATE/,
      );
    });

    it('FR-30: rejects an action outside the flag lifecycle', async () => {
      const env = await createEnvironment();
      const flag = await createFlag(env.id);
      await expect(
        prisma.auditLog.create({
          data: {
            environmentId: env.id,
            flagId: flag.id,
            action: 'DELETED',
            actorId: 'admin@example.com',
            newState: {},
            performedAt: new Date('2026-10-14T10:00:00.000Z'),
          },
        }),
      ).rejects.toThrow(/audit_logs_action_valid/);
    });

    it('FR-13: a flag referenced by audit logs cannot be hard-deleted', async () => {
      const env = await createEnvironment();
      const flag = await createFlag(env.id);
      await createAuditLog(env.id, flag.id);
      await expect(prisma.featureFlag.delete({ where: { id: flag.id } })).rejects.toBeDefined();
    });
  });
});
