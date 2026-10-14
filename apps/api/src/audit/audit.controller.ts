import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  listAuditLogsQuerySchema,
  type AuditLogDto,
  type ListAuditLogsQuery,
  type Page,
} from '@flagforge/shared';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { AuditService } from './audit.service';

@Controller('environments/:environmentId/audit-logs')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  /** FR-30, FR-31 */
  @Get()
  list(
    @Param('environmentId', ParseUUIDPipe) environmentId: string,
    @Query(new ZodValidationPipe(listAuditLogsQuerySchema)) query: ListAuditLogsQuery,
  ): Promise<Page<AuditLogDto>> {
    return this.audit.list(environmentId, query);
  }
}
