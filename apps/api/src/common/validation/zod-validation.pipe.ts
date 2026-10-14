import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';

export interface ValidationErrorDetail {
  path: (string | number)[];
  message: string;
}

/**
 * SEC-03: validates a request part against a Zod schema and returns the parsed value.
 * Failures produce the error format from design §6.4.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    const details: ValidationErrorDetail[] = result.error.issues.map((issue) => ({
      path: issue.path.filter((p): p is string | number => typeof p !== 'symbol'),
      message: issue.message,
    }));
    throw new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details,
    });
  }
}
