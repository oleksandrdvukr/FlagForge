import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import {
  evaluationRequestSchema,
  type EvaluationRequest,
  type EvaluationResponse,
} from '@flagforge/shared';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { EvaluationService } from './evaluation.service';
import { RateLimitGuard } from './rate-limit.guard';
import { SdkKeyGuard, type SdkRequest } from './sdk-key.guard';

@Controller()
export class EvaluationController {
  constructor(private readonly evaluation: EvaluationService) {}

  /** FR-20, FR-33, SEC-03, SEC-04. Guards run in order: authenticate, then rate-limit. */
  @Post('evaluate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(SdkKeyGuard, RateLimitGuard)
  evaluate(
    @Req() req: SdkRequest,
    @Body(new ZodValidationPipe(evaluationRequestSchema)) body: EvaluationRequest,
  ): Promise<EvaluationResponse> {
    return this.evaluation.evaluate(req.environment!.id, body);
  }
}
