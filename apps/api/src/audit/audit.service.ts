import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  AuditAction,
  AuditLogDto,
  FlagDto,
  ListAuditLogsQuery,
  Page,
} from '@flagforge/shared';
import type { AuditLog, Prisma } from '@prisma/client';
import { CLOCK, type Clock } from '../common/clock/clock';
import { PrismaService } from '../common/prisma/prisma.service';

export interface AuditEntry {
  environmentId: string;
  flagId: string;
  action: AuditAction;
  actorId: string;
  previousState: FlagDto | null;
  newState: FlagDto;
}

function toAuditLogDto(log: AuditLog): AuditLogDto {
  return {
    id: log.id.toString(),
    environmentId: log.environmentId,
    flagId: log.flagId,
    action: log.action as AuditAction,
    actorId: log.actorId,
    previousState: log.previousState as unknown as FlagDto | null,
    newState: log.newState as unknown as FlagDto,
    timestamp: log.performedAt.toISOString(),
  };
}

@Injectable()
export class AuditService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** FR-30, FR-31: written inside the caller's transaction, so it commits or rolls back with the change. */
  async record(tx: Prisma.TransactionClient, entry: AuditEntry): Promise<void> {
    await tx.auditLog.create({
      data: {
        ...entry,
        previousState: (entry.previousState ?? undefined) as Prisma.InputJsonValue | undefined,
        newState: entry.newState as unknown as Prisma.InputJsonValue,
        performedAt: this.clock.now(),
      },
    });
  }

  /** FR-30, FR-31: newest first. */
  async list(environmentId: string, query: ListAuditLogsQuery): Promise<Page<AuditLogDto>> {
    const environment = await this.prisma.environment.findUnique({ where: { id: environmentId } });
    if (!environment) throw new NotFoundException(`Environment ${environmentId} not found`);

    const where = { environmentId, ...(query.flagId ? { flagId: query.flagId } : {}) };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: [{ performedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items: items.map(toAuditLogDto), page: query.page, pageSize: query.pageSize, total };
  }
}
