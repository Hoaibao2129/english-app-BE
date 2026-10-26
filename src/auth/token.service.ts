import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { RefreshTokenService } from './refresh-token.service.js';
import type { AuthUser, Role, TokenPair } from './auth.types.js';

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly refresh_tokens: RefreshTokenService,
  ) {}

  sign_access_token(user: AuthUser): Promise<string> {
    return this.jwt.signAsync(
      { sub: user.user_id, email: user.email, role: user.role },
      { algorithm: 'HS256' },
    );
  }

  async verify_access_token(token: string): Promise<AuthUser> {
    let payload: { sub?: unknown; email?: unknown; role?: unknown };
    try {
      payload = await this.jwt.verifyAsync(token, { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    if (
      typeof payload.sub !== 'string' ||
      !/^[0-9a-f]{24}$/i.test(payload.sub) ||
      typeof payload.email !== 'string' ||
      (payload.role !== 'user' && payload.role !== 'admin')
    ) {
      throw new UnauthorizedException('Invalid or expired access token');
    }
    return {
      user_id: payload.sub,
      email: payload.email,
      role: payload.role as Role,
    };
  }

  async issue_tokens(user: AuthUser): Promise<TokenPair> {
    const access_token = await this.sign_access_token(user);
    const refresh_token = await this.refresh_tokens.create_refresh_token(
      user.user_id,
    );
    return { access_token, refresh_token };
  }
}
