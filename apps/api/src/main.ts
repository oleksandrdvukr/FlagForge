import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { APP_OPTIONS, configureApp } from './configure-app';

async function bootstrap(): Promise<void> {
  const app = configureApp(
    await NestFactory.create<NestExpressApplication>(AppModule, APP_OPTIONS),
  );
  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
