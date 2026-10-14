import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AdminGuard } from './admin.guard';
import { AUTH_CONFIG, authConfigFromEnv } from './auth.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [
    { provide: AUTH_CONFIG, useFactory: () => authConfigFromEnv() },
    AuthService,
    { provide: APP_GUARD, useClass: AdminGuard },
  ],
})
export class AuthModule {}
