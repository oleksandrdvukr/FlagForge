import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { toErrorBody } from './all-exceptions.filter';

describe('toErrorBody', () => {
  it('SEC-03: keeps validation details from ZodValidationPipe', () => {
    const details = [{ path: ['name'], message: 'Required' }];
    const body = toErrorBody(
      new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
        details,
      }),
    );
    expect(body).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details,
    });
  });

  it('normalizes built-in Nest exceptions', () => {
    expect(toErrorBody(new NotFoundException('Flag not found'))).toEqual({
      statusCode: 404,
      error: 'Not Found',
      message: 'Flag not found',
    });
  });

  it('fills `error` from the status code when missing', () => {
    expect(toErrorBody(new HttpException('Slow down', 429))).toEqual({
      statusCode: 429,
      error: 'Too Many Requests',
      message: 'Slow down',
    });
  });

  it('joins array messages', () => {
    const body = toErrorBody(new BadRequestException({ message: ['a', 'b'] }));
    expect(body.message).toBe('a; b');
  });

  it('hides internals of unexpected errors behind a generic 500', () => {
    expect(toErrorBody(new Error('connection string postgres://secret'))).toEqual({
      statusCode: 500,
      error: 'Internal Server Error',
      message: 'Internal server error',
    });
  });
});
