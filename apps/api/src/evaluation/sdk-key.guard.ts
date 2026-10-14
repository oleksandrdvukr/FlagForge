import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Environment } from '@prisma/client';
import type { Request } from 'express';
import { EnvironmentsService } from '../environments/environments.service';

export const SDK_KEY_HEADER = 'x-environment-key';

export interface SdkRequest extends Request {
  environment?: Environment;
}

/** FR-33: authenticates evaluation requests by the environment SDK key header. */
@Injectable()
export class SdkKeyGuard implements CanActivate {
  constructor(private readonly environments: EnvironmentsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<SdkRequest>();
    const rawKey = req.header(SDK_KEY_HEADER);
    const environment = rawKey ? await this.environments.findBySdkKey(rawKey) : null;
    if (!environment) throw new UnauthorizedException('Missing or invalid SDK key');
    req.environment = environment;
    return true;
  }
}
