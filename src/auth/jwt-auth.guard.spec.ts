import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type { TokenService } from './token.service.js';

describe('JwtAuthGuard', () => {
  const user = { user_id: 'u1', email: 'a@x.com', role: 'user' as const };
  const verify = jest.fn<(t: string) => Promise<typeof user>>();
  const guard = new JwtAuthGuard({
    verify_access_token: verify,
  } as unknown as TokenService);

  const ctx = (authorization?: string) => {
    const request: { headers: { authorization?: string }; user?: unknown } = {
      headers: { authorization },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    return { request, context };
  };

  beforeEach(() => verify.mockReset().mockResolvedValue(user));

  it.each(['Bearer tok', 'bearer tok', 'BEARER   tok', 'Bearer\ttok'])(
    'accepts %j',
    async (header) => {
      const { request, context } = ctx(header);
      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(verify).toHaveBeenCalledWith('tok');
      expect(request.user).toEqual(user);
    },
  );

  it.each([undefined, '', 'Basic tok', 'Bearer', 'Bearer a b', 'Bearertok'])(
    'rejects %j',
    async (header) => {
      await expect(
        guard.canActivate(ctx(header).context),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    },
  );
});
