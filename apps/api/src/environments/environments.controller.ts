import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { EnvironmentDto, SdkKeyResponse } from '@flagforge/shared';
import { EnvironmentsService } from './environments.service';

@Controller()
export class EnvironmentsController {
  constructor(private readonly environments: EnvironmentsService) {}

  /** FR-02 */
  @Get('workspaces/:workspaceId/environments')
  list(@Param('workspaceId', ParseUUIDPipe) workspaceId: string): Promise<EnvironmentDto[]> {
    return this.environments.listByWorkspace(workspaceId);
  }

  /** FR-03, FR-04, FR-05 */
  @Post('environments/:environmentId/sdk-key/rotate')
  @HttpCode(HttpStatus.OK)
  rotate(@Param('environmentId', ParseUUIDPipe) environmentId: string): Promise<SdkKeyResponse> {
    return this.environments.rotateSdkKey(environmentId);
  }
}
