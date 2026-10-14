import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  targetingRulesSchema,
  type CreateFlagRequest,
  type FlagDto,
  type ListFlagsQuery,
  type Page,
  type UpdateFlagRequest,
} from '@flagforge/shared';
import { Prisma, type FeatureFlag } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CLOCK, type Clock } from '../common/clock/clock';
import { PrismaService } from '../common/prisma/prisma.service';

export function toFlagDto(flag: FeatureFlag): FlagDto {
  return {
    id: flag.id,
    environmentId: flag.environmentId,
    key: flag.key,
    name: flag.name,
    description: flag.description,
    isEnabled: flag.isEnabled,
    percentageRollout: flag.percentageRollout,
    targetingRules: targetingRulesSchema.parse(flag.targetingRules),
    createdAt: flag.createdAt.toISOString(),
    updatedAt: flag.updatedAt.toISOString(),
    archivedAt: flag.archivedAt?.toISOString() ?? null,
  };
}

const isUniqueViolation = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';

@Injectable()
export class FlagsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** FR-10, FR-30: new flags start Disabled (SRS §4.5). Keys of archived flags stay reserved. */
  async create(environmentId: string, input: CreateFlagRequest, actorId: string): Promise<FlagDto> {
    const environment = await this.prisma.environment.findUnique({ where: { id: environmentId } });
    if (!environment) throw new NotFoundException(`Environment ${environmentId} not found`);

    const now = this.clock.now();
    try {
      return await this.prisma.$transaction(async (tx) => {
        const flag = toFlagDto(
          await tx.featureFlag.create({
            data: {
              environmentId,
              key: input.key,
              name: input.name,
              description: input.description ?? null,
              isEnabled: input.isEnabled,
              percentageRollout: input.percentageRollout,
              targetingRules: input.targetingRules,
              createdAt: now,
              updatedAt: now,
            },
          }),
        );
        await this.audit.record(tx, {
          environmentId,
          flagId: flag.id,
          action: 'CREATED',
          actorId,
          previousState: null,
          newState: flag,
        });
        return flag;
      });
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException(`Flag "${input.key}" already exists in this environment`);
      }
      throw e;
    }
  }

  /** FR-11: archived flags are excluded; `q` matches key or name, case-insensitive. */
  async list(environmentId: string, query: ListFlagsQuery): Promise<Page<FlagDto>> {
    const environment = await this.prisma.environment.findUnique({ where: { id: environmentId } });
    if (!environment) throw new NotFoundException(`Environment ${environmentId} not found`);

    const where: Prisma.FeatureFlagWhereInput = {
      environmentId,
      archivedAt: null,
      ...(query.q
        ? {
            OR: [
              { key: { contains: query.q, mode: 'insensitive' } },
              { name: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.featureFlag.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { key: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.featureFlag.count({ where }),
    ]);
    return { items: items.map(toFlagDto), page: query.page, pageSize: query.pageSize, total };
  }

  /** FR-11 */
  async get(flagId: string): Promise<FlagDto> {
    const flag = await this.prisma.featureFlag.findFirst({
      where: { id: flagId, archivedAt: null },
    });
    if (!flag) throw new NotFoundException(`Flag ${flagId} not found`);
    return toFlagDto(flag);
  }

  /** FR-12, FR-30: `isEnabled: false` is the kill-switch. */
  update(flagId: string, input: UpdateFlagRequest, actorId: string): Promise<FlagDto> {
    return this.prisma.$transaction(async (tx) => {
      const before = await this.lockActive(tx, flagId);
      const after = toFlagDto(
        await tx.featureFlag.update({
          where: { id: flagId },
          data: { ...input, updatedAt: this.clock.now() },
        }),
      );
      await this.audit.record(tx, {
        environmentId: after.environmentId,
        flagId,
        action: 'UPDATED',
        actorId,
        previousState: before,
        newState: after,
      });
      return after;
    });
  }

  /** FR-13, FR-30: soft delete; `Archived` is terminal (SRS §4.5). */
  async archive(flagId: string, actorId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const before = await this.lockActive(tx, flagId);
      const now = this.clock.now();
      const archived = await tx.featureFlag.update({
        where: { id: flagId },
        data: { archivedAt: now, updatedAt: now },
      });
      await this.audit.record(tx, {
        environmentId: before.environmentId,
        flagId,
        action: 'ARCHIVED',
        actorId,
        previousState: before,
        newState: toFlagDto(archived),
      });
    });
  }

  /**
   * Row-locks an active flag for the rest of the transaction so concurrent updates
   * serialize and each audit entry records the true previous state.
   */
  private async lockActive(tx: Prisma.TransactionClient, flagId: string): Promise<FlagDto> {
    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM feature_flags WHERE id = ${flagId}::uuid AND archived_at IS NULL FOR UPDATE`;
    if (locked.length === 0) throw new NotFoundException(`Flag ${flagId} not found`);
    return toFlagDto(await tx.featureFlag.findUniqueOrThrow({ where: { id: flagId } }));
  }
}
