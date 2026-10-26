import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { get_current_user } from './current-user.decorator.js';

const ctx = (request: object) =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

describe('CurrentUser', () => {
  it('returns request.user', () => {
    const user = { user_id: 'u', email: 'a@x.com', role: 'user' };
    expect(get_current_user(ctx({ user }))).toBe(user);
  });

  it('throws UnauthorizedException when request.user is missing', () => {
    expect(() => get_current_user(ctx({}))).toThrow(UnauthorizedException);
  });
});
