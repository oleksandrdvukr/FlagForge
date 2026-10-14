import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import {
  createFlagRequestSchema,
  listFlagsQuerySchema,
  updateFlagRequestSchema,
  type CreateFlagRequest,
  type FlagDto,
  type ListFlagsQuery,
  type Page,
  type UpdateFlagRequest,
} from '@flagforge/shared';
import type { AdminRequest } from '../auth/admin.guard';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { FlagsService } from './flags.service';

@Controller()
export class FlagsController {
  constructor(private readonly flags: FlagsService) {}

  /** FR-11 */
  @Get('environments/:environmentId/flags')
  list(
    @Param('environmentId', ParseUUIDPipe) environmentId: string,
    @Query(new ZodValidationPipe(listFlagsQuerySchema)) query: ListFlagsQuery,
  ): Promise<Page<FlagDto>> {
    return this.flags.list(environmentId, query);
  }

  /** FR-10 */
  @Post('environments/:environmentId/flags')
  create(
    @Param('environmentId', ParseUUIDPipe) environmentId: string,
    @Body(new ZodValidationPipe(createFlagRequestSchema)) body: CreateFlagRequest,
    @Req() req: AdminRequest,
  ): Promise<FlagDto> {
    return this.flags.create(environmentId, body, req.admin!.email);
  }

  /** FR-11 */
  @Get('flags/:flagId')
  get(@Param('flagId', ParseUUIDPipe) flagId: string): Promise<FlagDto> {
    return this.flags.get(flagId);
  }

  /** FR-12 */
  @Patch('flags/:flagId')
  update(
    @Param('flagId', ParseUUIDPipe) flagId: string,
    @Body(new ZodValidationPipe(updateFlagRequestSchema)) body: UpdateFlagRequest,
    @Req() req: AdminRequest,
  ): Promise<FlagDto> {
    return this.flags.update(flagId, body, req.admin!.email);
  }

  /** FR-13 */
  @Delete('flags/:flagId')
  @HttpCode(HttpStatus.NO_CONTENT)
  archive(@Param('flagId', ParseUUIDPipe) flagId: string, @Req() req: AdminRequest): Promise<void> {
    return this.flags.archive(flagId, req.admin!.email);
  }
}
