import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DynamicModule, Logger, Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';

/** `apps/api/dist` → `apps/web/dist` in the repo and in the Docker image. */
export function resolveWebDist(env: NodeJS.ProcessEnv = process.env): string {
  return resolve(env.WEB_DIST_PATH ?? join(__dirname, '..', '..', '..', 'web', 'dist'));
}

/**
 * ADR-0007: serves the built dashboard from the API process (same origin, no CORS).
 * Unknown paths fall back to `index.html` for client-side routing; API and health
 * routes are excluded so they keep returning JSON 404s. Skipped when the SPA isn't built
 * (API-only development, tests).
 */
@Module({})
export class SpaModule {
  static register(rootPath = resolveWebDist()): DynamicModule {
    if (!existsSync(join(rootPath, 'index.html'))) {
      new Logger(SpaModule.name).log(`Dashboard not built at ${rootPath}; serving API only`);
      return { module: SpaModule };
    }
    return {
      module: SpaModule,
      imports: [
        ServeStaticModule.forRoot({
          rootPath,
          exclude: ['/api/{*path}', '/healthz', '/readyz'],
        }),
      ],
    };
  }
}
