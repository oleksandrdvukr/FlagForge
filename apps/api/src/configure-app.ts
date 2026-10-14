import { INestApplication } from '@nestjs/common';
import { API_PREFIX } from '@flagforge/shared';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';

/** Applies app-wide settings. Shared by `main.ts` and e2e tests so both run the same setup. */
export function configureApp(app: INestApplication): INestApplication {
  // Health probes live at the root (design §6.3); everything else under /api/v1.
  app.setGlobalPrefix(API_PREFIX.replace(/^\//, ''), { exclude: ['healthz', 'readyz'] });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
  return app;
}
