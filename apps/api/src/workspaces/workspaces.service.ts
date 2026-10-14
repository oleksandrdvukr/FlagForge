import { Inject, Injectable } from '@nestjs/common';
import type {
  CreateWorkspaceRequest,
  CreateWorkspaceResponse,
  WorkspaceDto,
} from '@flagforge/shared';
import type { Workspace } from '@prisma/client';
import { CLOCK, type Clock } from '../common/clock/clock';
import { PrismaService } from '../common/prisma/prisma.service';
import { EnvironmentsService } from '../environments/environments.service';

function toWorkspaceDto(ws: Workspace): WorkspaceDto {
  return { id: ws.id, name: ws.name, createdAt: ws.createdAt.toISOString() };
}

@Injectable()
export class WorkspacesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly environments: EnvironmentsService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** FR-01, FR-02: workspace and its default environments are created atomically. */
  create(input: CreateWorkspaceRequest): Promise<CreateWorkspaceResponse> {
    return this.prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.create({
        data: { name: input.name, createdAt: this.clock.now() },
      });
      const environments = await this.environments.createDefaults(tx, workspace.id);
      return { workspace: toWorkspaceDto(workspace), environments };
    });
  }

  /** FR-01: newest first. */
  async list(): Promise<WorkspaceDto[]> {
    const workspaces = await this.prisma.workspace.findMany({ orderBy: { createdAt: 'desc' } });
    return workspaces.map(toWorkspaceDto);
  }
}
