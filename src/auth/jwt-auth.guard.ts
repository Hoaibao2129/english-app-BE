import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { TokenService } from './token.service.js';
import type { AuthUser } from './auth.types.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const header = request.headers.authorization;
    const match =
      typeof header === 'string' ? /^Bearer\s+(\S+)$/i.exec(header) : null;
    if (!match) {
      throw new UnauthorizedException('Missing or malformed bearer token');
    }
    request.user = await this.tokens.verify_access_token(match[1]);
    return true;
  }
}
