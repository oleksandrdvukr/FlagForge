import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Res } from '@nestjs/common';
import { loginRequestSchema, type LoginRequest } from '@flagforge/shared';
import type { CookieOptions, Response } from 'express';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { AUTH_CONFIG, SESSION_COOKIE, SESSION_TTL_SECONDS, type AuthConfig } from './auth.config';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

@Controller('auth')
@Public()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  /** SEC-02: HttpOnly, SameSite=Lax, Secure in production, 12 h. */
  private cookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.secureCookies,
      path: '/',
    };
  }

  /** FR-32 */
  @Post('login')
  @HttpCode(HttpStatus.NO_CONTENT)
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const token = await this.auth.login(body.email, body.password);
    res.cookie(SESSION_COOKIE, token, {
      ...this.cookieOptions(),
      maxAge: SESSION_TTL_SECONDS * 1000,
    });
  }

  /** FR-32 */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(SESSION_COOKIE, this.cookieOptions());
  }
}
