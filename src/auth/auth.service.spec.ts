import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User } from './schemas/user.schema.js';
import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { ConflictException, UnauthorizedException } from '@nestjs/common';
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
});
