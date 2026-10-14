import { Injectable, NotFoundException } from '@nestjs/common';
import {
  targetingRulesSchema,
  type EvaluationRequest,
  type EvaluationResponse,
} from '@flagforge/shared';
import { PrismaService } from '../common/prisma/prisma.service';
import { evaluate } from './engine';

@Injectable()
export class EvaluationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * FR-20 – FR-24: one indexed read, then the pure engine. No writes, nothing retained (NFR-04).
   * Archived flags behave as missing (FR-13).
   */
  async evaluate(environmentId: string, request: EvaluationRequest): Promise<EvaluationResponse> {
    const flag = await this.prisma.featureFlag.findFirst({
      where: { environmentId, key: request.flagKey, archivedAt: null },
      select: { key: true, isEnabled: true, percentageRollout: true, targetingRules: true },
    });
    if (!flag) throw new NotFoundException(`Flag "${request.flagKey}" not found`);

    const result = evaluate(
      {
        key: flag.key,
        isEnabled: flag.isEnabled,
        percentageRollout: flag.percentageRollout,
        // ADR-0002: rules are validated on write; re-parsing guards against rows edited outside the app.
        targetingRules: targetingRulesSchema.parse(flag.targetingRules),
      },
      { userId: request.userId, attributes: request.attributes },
    );
    return { flagKey: flag.key, ...result };
  }
}
