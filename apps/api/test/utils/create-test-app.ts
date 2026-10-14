import { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { APP_OPTIONS, configureApp } from '../../src/configure-app';

/** Boots the full application the same way `main.ts` does, with optional provider overrides. */
export async function createTestApp(
  customize: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<INestApplication> {
  const moduleRef = await customize(Test.createTestingModule({ imports: [AppModule] })).compile();
  const app = configureApp(moduleRef.createNestApplication<NestExpressApplication>(APP_OPTIONS));
  await app.init();
  return app;
}
