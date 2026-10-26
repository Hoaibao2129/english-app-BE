import {
  createParamDecorator,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import type { AuthUser } from './auth.types.js';

export function get_current_user(context: ExecutionContext): AuthUser {
  const user = context.switchToHttp().getRequest<{ user?: AuthUser }>().user;
  // A route that forgot JwtAuthGuard fails closed as 401, not 500.
  if (!user) throw new UnauthorizedException('Authentication required');
  return user;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser =>
    get_current_user(context),
);
