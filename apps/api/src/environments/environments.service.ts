import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  ENVIRONMENT_NAMES,
  SDK_KEY_PREFIXES,
  type EnvironmentDto,
  type EnvironmentName,
  type EnvironmentWithSdkKeyDto,
  type SdkKeyResponse,
} from '@flagforge/shared';
import type { Environment, Prisma } from '@prisma/client';
import { CLOCK, type Clock } from '../common/clock/clock';
import { PrismaService } from '../common/prisma/prisma.service';
import { generateSdkKey, hashSdkKey } from './sdk-key';

export function toEnvironmentDto(env: Environment): EnvironmentDto {
  const name = env.name as EnvironmentName;
  return {
    id: env.id,
    workspaceId: env.workspaceId,
    name,
    sdkKeyPrefix: SDK_KEY_PREFIXES[name],
    createdAt: env.createdAt.toISOString(),
  };
}

@Injectable()
export class EnvironmentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /**
   * FR-02, FR-03: creates the default environments inside the caller's transaction.
   * Raw keys are returned once and never stored (FR-04, SEC-01).
   */
  async createDefaults(
    tx: Prisma.TransactionClient,
    workspaceId: string,
  ): Promise<EnvironmentWithSdkKeyDto[]> {
    const createdAt = this.clock.now();
    const result: EnvironmentWithSdkKeyDto[] = [];
    for (const name of ENVIRONMENT_NAMES) {
      const sdkKey = generateSdkKey(name);
      const env = await tx.environment.create({
        data: { workspaceId, name, sdkKeyHash: hashSdkKey(sdkKey), createdAt },
      });
      result.push({ ...toEnvironmentDto(env), sdkKey });
    }
    return result;
  }

  /** FR-02 */
  async listByWorkspace(workspaceId: string): Promise<EnvironmentDto[]> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { environments: { orderBy: { name: 'asc' } } },
    });
    if (!workspace) throw new NotFoundException(`Workspace ${workspaceId} not found`);
    return workspace.environments.map(toEnvironmentDto);
  }

  /** FR-05: replaces the stored hash in one statement; the old key stops working immediately. */
  async rotateSdkKey(environmentId: string): Promise<SdkKeyResponse> {
    const env = await this.prisma.environment.findUnique({ where: { id: environmentId } });
    if (!env) throw new NotFoundException(`Environment ${environmentId} not found`);

    const sdkKey = generateSdkKey(env.name as EnvironmentName);
    await this.prisma.environment.update({
      where: { id: environmentId },
      data: { sdkKeyHash: hashSdkKey(sdkKey) },
    });
    return { environmentId, sdkKey };
  }

  /** FR-33: resolves a raw SDK key to its environment by hash, or `null` if unknown. */
  findBySdkKey(rawKey: string): Promise<Environment | null> {
    return this.prisma.environment.findUnique({ where: { sdkKeyHash: hashSdkKey(rawKey) } });
  }
}
