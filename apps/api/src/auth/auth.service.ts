import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { CLOCK, type Clock } from '../common/clock/clock';
import { AUTH_CONFIG, SESSION_TTL_SECONDS, type AuthConfig } from './auth.config';

export interface AdminIdentity {
  email: string;
}

interface SessionPayload {
  sub: string;
  iat: number;
  exp: number;
}

/** Compared against when the email is wrong, so both failure paths cost one bcrypt check. */
const DUMMY_HASH = '$2b$12$arEVZJ7Wcg7yyN87N4MqgOCvNmhP9q32r3PIz.KtkCR8bOxVKr4U2';

@Injectable()
export class AuthService {
  private readonly jwt: JwtService;

  constructor(
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {
    this.jwt = new JwtService({ secret: config.jwtSecret, signOptions: { algorithm: 'HS256' } });
  }

  /** FR-32: returns a signed session token, or throws 401 without revealing which part was wrong. */
  async login(email: string, password: string): Promise<string> {
    const emailMatches = email.toLowerCase() === this.config.adminEmail;
    const passwordMatches = await compare(
      password,
      emailMatches ? this.config.adminPasswordHash : DUMMY_HASH,
    );
    if (!emailMatches || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    // iat/exp come from the injected Clock so expiry is testable (SEC-02, CLAUDE.md).
    const iat = Math.floor(this.clock.now().getTime() / 1000);
    const payload: SessionPayload = {
      sub: this.config.adminEmail,
      iat,
      exp: iat + SESSION_TTL_SECONDS,
    };
    return this.jwt.signAsync(payload);
  }

  /** Returns the admin for a valid, unexpired token, otherwise `null`. */
  async verify(token: string): Promise<AdminIdentity | null> {
    try {
      const payload = await this.jwt.verifyAsync<SessionPayload>(token, {
        algorithms: ['HS256'],
        clockTimestamp: Math.floor(this.clock.now().getTime() / 1000),
      });
      return payload.sub === this.config.adminEmail ? { email: payload.sub } : null;
    } catch {
      return null;
    }
  }
}
