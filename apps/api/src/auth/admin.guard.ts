import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SESSION_COOKIE } from './auth.config';
import { AuthService, type AdminIdentity } from './auth.service';
import { IS_PUBLIC } from './public.decorator';

export interface AdminRequest extends Request {
  admin?: AdminIdentity;
}

/**
 * FR-32: global guard — every route requires an admin session unless marked `@Public()`.
 * Deny-by-default means a new endpoint cannot be exposed by forgetting a decorator.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AdminRequest>();
    const token = (req.cookies as Record<string, string> | undefined)?.[SESSION_COOKIE];
    const admin = token ? await this.auth.verify(token) : null;
    if (!admin) throw new UnauthorizedException('Authentication required');
    req.admin = admin;
    return true;
  }
}
