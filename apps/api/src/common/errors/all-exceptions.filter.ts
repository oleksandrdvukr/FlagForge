import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { STATUS_CODES } from 'node:http';

/** Error body from design §6.4 / OpenAPI `Error`. */
export interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown[];
}

export function toErrorBody(exception: unknown): ErrorBody {
  if (!(exception instanceof HttpException)) {
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'Internal server error',
    };
  }

  const statusCode = exception.getStatus();
  const response = exception.getResponse();
  const body: Record<string, unknown> =
    typeof response === 'string' ? { message: response } : (response as Record<string, unknown>);
  const message = Array.isArray(body.message) ? body.message.join('; ') : body.message;

  return {
    statusCode,
    error: typeof body.error === 'string' ? body.error : (STATUS_CODES[statusCode] ?? 'Error'),
    message: typeof message === 'string' ? message : exception.message,
    ...(Array.isArray(body.details) ? { details: body.details } : {}),
  };
}

/**
 * Normalizes every error to one JSON shape. Unexpected errors become a generic 500;
 * their details are logged server-side only. Request headers and bodies are never
 * logged, so SDK keys and passwords cannot leak through logs (SEC-01).
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const body = toErrorBody(exception);
    if (body.statusCode >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    }
    host.switchToHttp().getResponse<Response>().status(body.statusCode).json(body);
  }
}
