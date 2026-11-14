import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from './schemas/user.schema.js';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import {
  mongoose_test_module,
  start_mongo,
} from '../test-utils/mongo-memory.js';
import { AuthModule } from './auth.module.js';
import { AuthService } from './auth.service.js';
import { WordProgress } from '../vocabulary/schemas/word-progress.schema.js';
import { AnswerLog } from '../vocabulary/schemas/answer-log.schema.js';
import { UsersService } from './users.service.js';
import { MailService } from '../mail/mail.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { TokenService } from './token.service.js';
import { JwtService } from '@nestjs/jwt';

describe('AuthService', () => {
  let mongo: Awaited<ReturnType<typeof start_mongo>>;
  let module_ref: Awaited<
    ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>
  >;
  let auth: AuthService;
  let users: UsersService;
  let users_model: Model<User>;

  beforeAll(async () => {
    mongo = await start_mongo();
    module_ref = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_SECRET: 'x'.repeat(32), JWT_ACCESS_TTL: '15m' })],
        }),
        mongoose_test_module(mongo.uri),
        AuthModule,
      ],
    }).compile();
    await module_ref.init();
    auth = module_ref.get(AuthService);
    users = module_ref.get(UsersService);
    users_model = module_ref.get(getModelToken(User.name), { strict: false });
  }, 120000);

  afterAll(async () => {
    await module_ref?.close();
    await mongo?.stop();
  });

  it('register hashes password', async () => {
    await auth.register({ email: 'a@x.com', password: 'password1' });
    const doc = await users.find_by_email('a@x.com');
    expect(doc!.password_hash).not.toBe('password1');
    expect(await bcrypt.compare('password1', doc!.password_hash)).toBe(true);
  });

  it('register lowercases+trims email', async () => {
    const result = await auth.register({
      email: '  Bob@Example.COM ',
      password: 'password1',
    });
    expect(result.user.email).toBe('bob@example.com');
    expect(result.user.role).toBe('user');
    expect(result.user.display_name).toBeNull();
  });

  it('duplicate email (different case) gives 409', async () => {
    await auth.register({ email: 'dup@x.com', password: 'password1' });
    await expect(
      auth.register({ email: 'DUP@x.com', password: 'password1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('login with differently cased email works', async () => {
    await auth.register({ email: 'case@x.com', password: 'password1' });
    const result = await auth.login({
      email: 'CASE@x.com',
      password: 'password1',
    });
    expect(result.access_token).toBeTruthy();
    expect(result.refresh_token).toBeTruthy();
  });

  it('wrong password and unknown email give identical 401 message', async () => {
    await auth.register({ email: 'w@x.com', password: 'password1' });
    const errors: UnauthorizedException[] = [];
    for (const input of [
      { email: 'w@x.com', password: 'wrong-password' },
      { email: 'nobody@x.com', password: 'password1' },
    ]) {
      try {
        await auth.login(input);
      } catch (error) {
        errors.push(error as UnauthorizedException);
      }
    }
    expect(errors).toHaveLength(2);
    expect(errors[0]).toBeInstanceOf(UnauthorizedException);
    expect(errors[0].message).toBe('Invalid email or password');
    expect(errors[1].message).toBe(errors[0].message);
  });

  it('AuthResult.user has no password_hash', async () => {
    const result = await auth.register({
      email: 'n@x.com',
      password: 'password1',
      display_name: 'Nam',
    });
    expect(JSON.stringify(result)).not.toContain('password_hash');
    expect(result.user.display_name).toBe('Nam');
    expect(await auth.get_me(result.user.id)).toEqual(result.user);
  });

  it('first register claims legacy rows without user_id; second claims nothing', async () => {
    const progress = module_ref.get(getModelToken(WordProgress.name), {
      strict: false,
    });
    const logs = module_ref.get(getModelToken(AnswerLog.name), {
      strict: false,
    });
    await users_model.deleteMany({});
    await progress.deleteMany({});
    await logs.deleteMany({});
    const legacy = new Types.ObjectId();
    await progress.collection.insertOne({
      word_id: legacy,
      topic_id: legacy,
      last_result: 'correct',
    });
    await logs.collection.insertMany([
      { word_id: legacy, topic_id: legacy },
      { word_id: legacy, topic_id: legacy },
    ]);
    const first = await auth.register({
      email: 'first@x.com',
      password: 'password1',
    });
    const owned = { user_id: new Types.ObjectId(first.user.id) };
    expect(await progress.countDocuments(owned)).toBe(1);
    expect(await logs.countDocuments(owned)).toBe(2);

    await progress.collection.insertOne({
      word_id: new Types.ObjectId(),
      topic_id: legacy,
      last_result: 'wrong',
    });
    const second = await auth.register({
      email: 'second@x.com',
      password: 'password1',
    });
    expect(
      await progress.countDocuments({
        user_id: new Types.ObjectId(second.user.id),
      }),
    ).toBe(0);
    expect(await progress.countDocuments({ user_id: { $exists: false } })).toBe(
      1,
    );
  });

  it('verify_access_token rejects a non-ObjectId sub with 401', async () => {
    const jwt = module_ref.get(JwtService, { strict: false });
    const tokens = module_ref.get(TokenService, { strict: false });
    const token = await jwt.signAsync(
      { sub: 'not-an-object-id', email: 'a@x.com', role: 'user' },
      { algorithm: 'HS256' },
    );
    await expect(tokens.verify_access_token(token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('login retries the legacy claim when there is exactly one user', async () => {
    const progress = module_ref.get(getModelToken(WordProgress.name), {
      strict: false,
    });
    await users_model.deleteMany({});
    await progress.deleteMany({});
    const reg = await auth.register({
      email: 'retry@x.com',
      password: 'password1',
    });
    const legacy = new Types.ObjectId();
    await progress.collection.insertOne({
      word_id: legacy,
      topic_id: legacy,
      last_result: 'correct',
    });
    await auth.login({ email: 'retry@x.com', password: 'password1' });
    expect(
      await progress.countDocuments({
        user_id: new Types.ObjectId(reg.user.id),
      }),
    ).toBe(1);
  });

  describe('forgot password', () => {
    let sent: { to: string; text: string }[];
    let fail_mail: boolean;

    const latest_otp = (): string => /\d{6}/.exec(sent.at(-1)!.text)![0];
    const request_otp = (email: string) => auth.request_password_otp({ email });
    const wrong_otp = (otp: string) => (otp === '000000' ? '111111' : '000000');

    beforeEach(async () => {
      sent = [];
      fail_mail = false;
      module_ref.get(MailService, { strict: false }).transport = {
        sendMail: (message) => {
          if (fail_mail) return Promise.reject(new Error('smtp down'));
          sent.push({ to: message.to, text: message.text });
          return Promise.resolve({});
        },
      };
      auth.now = () => new Date();
      await users_model.deleteMany({});
      await auth.register({ email: 'fa@x.com', password: 'password1' });
      await auth.register({ email: 'fb@x.com', password: 'password1' });
    });

    afterAll(() => {
      auth.now = () => new Date();
    });

    it('request throws 404 when the email is not registered', async () => {
      await expect(request_otp('nobody@x.com')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(sent).toHaveLength(0);
    });

    it('request emails a 6-digit otp to the registered email and returns the expiry', async () => {
      const result = await request_otp('FA@x.com');
      expect(result).toEqual({ message: 'OTP sent', expires_in_seconds: 300 });
      expect(sent).toHaveLength(1);
      expect(sent[0].to).toBe('fa@x.com');
      expect(latest_otp()).toMatch(/^\d{6}$/);
    });

    it('request stores the otp only as a hash', async () => {
      await request_otp('fa@x.com');
      const raw = JSON.stringify(
        await users_model.findOne({ email: 'fa@x.com' }).lean(),
      );
      expect(raw).not.toContain(latest_otp());
      expect(raw).not.toContain('"otp":');
    });

    it('request returns 503 and clears the state when the mail fails', async () => {
      fail_mail = true;
      await expect(request_otp('fa@x.com')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      const doc = await users.find_by_email('fa@x.com');
      expect(doc!.password_reset).toBeNull();
    });

    it('a new otp invalidates the previous one', async () => {
      await request_otp('fa@x.com');
      const first = latest_otp();
      await request_otp('fa@x.com');
      const second = latest_otp();
      if (first !== second) {
        await expect(
          auth.verify_password_otp({ email: 'fa@x.com', otp: first }),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
      await expect(
        auth.verify_password_otp({ email: 'fa@x.com', otp: second }),
      ).resolves.toEqual(expect.objectContaining({ expires_in_seconds: 300 }));
    });

    it('verify throws 404 for an unknown email and 400 when no otp was requested', async () => {
      await expect(
        auth.verify_password_otp({ email: 'nobody@x.com', otp: '123456' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        auth.verify_password_otp({ email: 'fa@x.com', otp: '123456' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('verify throws 400 for a wrong otp', async () => {
      await request_otp('fa@x.com');
      await expect(
        auth.verify_password_otp({
          email: 'fa@x.com',
          otp: wrong_otp(latest_otp()),
        }),
      ).rejects.toThrow('OTP is invalid or expired');
    });

    it('verify throws 400 for an expired otp', async () => {
      await request_otp('fa@x.com');
      const otp = latest_otp();
      auth.now = () => new Date(Date.now() + 5 * 60_000 + 1000);
      await expect(
        auth.verify_password_otp({ email: 'fa@x.com', otp }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('verify invalidates the otp after 5 wrong attempts', async () => {
      await request_otp('fa@x.com');
      const otp = latest_otp();
      for (let i = 0; i < 5; i++) {
        await expect(
          auth.verify_password_otp({ email: 'fa@x.com', otp: wrong_otp(otp) }),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
      await expect(
        auth.verify_password_otp({ email: 'fa@x.com', otp }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('verify returns a reset token and the otp cannot be reused', async () => {
      await request_otp('fa@x.com');
      const otp = latest_otp();
      const result = await auth.verify_password_otp({
        email: 'fa@x.com',
        otp,
      });
      expect(result.reset_token).toEqual(expect.any(String));
      expect(result.expires_in_seconds).toBe(300);
      await expect(
        auth.verify_password_otp({ email: 'fa@x.com', otp }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('otp of user A does not verify for user B', async () => {
      await request_otp('fa@x.com');
      await request_otp('fb@x.com');
      const otp_b = latest_otp();
      const otp_a = /\d{6}/.exec(sent[0].text)![0];
      if (otp_a !== otp_b) {
        await expect(
          auth.verify_password_otp({ email: 'fa@x.com', otp: otp_b }),
        ).rejects.toBeInstanceOf(BadRequestException);
      }
    });

    const get_reset_token = async (email: string): Promise<string> => {
      await request_otp(email);
      const { reset_token } = await auth.verify_password_otp({
        email,
        otp: latest_otp(),
      });
      return reset_token;
    };

    it('reset throws 401 for an unknown or expired token', async () => {
      await expect(
        auth.reset_password({
          reset_token: 'nope',
          new_password: 'newpassword1',
          confirm_password: 'newpassword1',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      const reset_token = await get_reset_token('fa@x.com');
      auth.now = () => new Date(Date.now() + 5 * 60_000 + 1000);
      await expect(
        auth.reset_password({
          reset_token,
          new_password: 'newpassword1',
          confirm_password: 'newpassword1',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('reset with mismatching passwords returns a fresh token and keeps the password', async () => {
      const reset_token = await get_reset_token('fa@x.com');
      let error: BadRequestException | undefined;
      try {
        await auth.reset_password({
          reset_token,
          new_password: 'newpassword1',
          confirm_password: 'different1',
        });
      } catch (caught) {
        error = caught as BadRequestException;
      }
      expect(error).toBeInstanceOf(BadRequestException);
      const body = error!.getResponse() as Record<string, unknown>;
      expect(body.message).toBe('confirm_password must match new_password');
      expect(body.expires_in_seconds).toBe(300);
      const next = body.reset_token as string;
      expect(next).not.toBe(reset_token);

      await expect(
        auth.login({ email: 'fa@x.com', password: 'password1' }),
      ).resolves.toBeDefined();
      await expect(
        auth.reset_password({
          reset_token,
          new_password: 'newpassword1',
          confirm_password: 'newpassword1',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(
        auth.reset_password({
          reset_token: next,
          new_password: 'newpassword1',
          confirm_password: 'newpassword1',
        }),
      ).resolves.toEqual({ message: 'Password reset successfully' });
    });

    it('reset changes the password, consumes the token and revokes refresh tokens', async () => {
      const login_a = await auth.login({
        email: 'fa@x.com',
        password: 'password1',
      });
      const login_b = await auth.login({
        email: 'fb@x.com',
        password: 'password1',
      });
      const reset_token = await get_reset_token('fa@x.com');
      const input = {
        reset_token,
        new_password: 'newpassword1',
        confirm_password: 'newpassword1',
      };

      await expect(auth.reset_password(input)).resolves.toEqual({
        message: 'Password reset successfully',
      });

      await expect(
        auth.login({ email: 'fa@x.com', password: 'password1' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(
        auth.login({ email: 'fa@x.com', password: 'newpassword1' }),
      ).resolves.toBeDefined();
      await expect(auth.reset_password(input)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(auth.refresh(login_a.refresh_token)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      await expect(auth.refresh(login_b.refresh_token)).resolves.toBeDefined();
      expect(
        module_ref.get(RefreshTokenService, { strict: false }),
      ).toBeDefined();
      const user_b = await users.find_by_email('fb@x.com');
      expect(await bcrypt.compare('password1', user_b!.password_hash)).toBe(
        true,
      );
    });
  });
});
