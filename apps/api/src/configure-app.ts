import { HttpException, type NestApplicationOptions } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { API_PREFIX } from '@flagforge/shared';
import cookieParser from 'cookie-parser';
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { AllExceptionsFilter, toErrorBody } from './common/errors/all-exceptions.filter';

/**
 * Nest's built-in body parser is turned off: {@link configureApp} registers the JSON parser
 * itself, so its errors are handled before the SPA module's error middleware (which would
 * turn them into 404s on `/api/*`).
 */
export const APP_OPTIONS: NestApplicationOptions = { bodyParser: false };

export const JSON_BODY_LIMIT = '100kb';

/** Design §8: the dashboard loads only its own assets plus Google Fonts. */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
};

/** SEC-03: malformed JSON → 400, oversized body → 413, in the design §6.4 error format. */
const bodyParserErrors: ErrorRequestHandler = (err: unknown, _req, res, next) => {
  const status = (err as { status?: unknown } | null)?.status;
  const isParserError = typeof (err as { type?: unknown } | null)?.type === 'string';
  if (!isParserError || typeof status !== 'number' || status < 400 || status >= 500) {
    return next(err);
  }
  const message = status === 413 ? 'Request body too large' : 'Malformed JSON body';
  res.status(status).json(toErrorBody(new HttpException(message, status)));
};

/** Applies app-wide settings. Shared by `main.ts` and e2e tests so both run the same setup. */
export function configureApp(app: NestExpressApplication): NestExpressApplication {
  // Health probes live at the root (design §6.3); everything else under /api/v1.
  app.setGlobalPrefix(API_PREFIX.replace(/^\//, ''), { exclude: ['healthz', 'readyz'] });
  app.disable('x-powered-by');
  app.use(securityHeaders);
  app.useBodyParser('json', { limit: JSON_BODY_LIMIT });
  app.use(bodyParserErrors);
  app.use(cookieParser());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
  return app;
}
