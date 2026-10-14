import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  createWorkspaceRequestSchema,
  type CreateWorkspaceRequest,
  type CreateWorkspaceResponse,
  type WorkspaceDto,
} from '@flagforge/shared';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { WorkspacesService } from './workspaces.service';

@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  /** FR-01 */
  @Get()
  list(): Promise<WorkspaceDto[]> {
    return this.workspaces.list();
  }

  /** FR-01, FR-02, FR-03 */
  @Post()
  create(
    @Body(new ZodValidationPipe(createWorkspaceRequestSchema)) body: CreateWorkspaceRequest,
  ): Promise<CreateWorkspaceResponse> {
    return this.workspaces.create(body);
  }
}
