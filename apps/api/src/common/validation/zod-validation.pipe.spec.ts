import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(
    z.object({ name: z.string().trim().min(1), pct: z.number().max(100).default(0) }),
  );

  it('SEC-03: returns the parsed value (trimmed, defaults applied)', () => {
    expect(pipe.transform({ name: '  Acme  ' })).toEqual({ name: 'Acme', pct: 0 });
  });

  it('SEC-03: throws 400 with structured details (design §6.4)', () => {
    let error: unknown;
    try {
      pipe.transform({ name: '', pct: 101 });
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(BadRequestException);
    expect((error as BadRequestException).getResponse()).toEqual({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: [
        { path: ['name'], message: expect.any(String) },
        { path: ['pct'], message: expect.any(String) },
      ],
    });
  });

  it('SEC-03: rejects a non-object body', () => {
    expect(() => pipe.transform('not json')).toThrow(BadRequestException);
  });
});
