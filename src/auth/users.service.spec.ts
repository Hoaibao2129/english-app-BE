import { Test } from '@nestjs/testing';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  mongoose_test_module,
  start_mongo,
} from '../test-utils/mongo-memory.js';
import { User, UserSchema } from './schemas/user.schema.js';
import { UsersService } from './users.service.js';

const MAX_ATTEMPTS = 5;

describe('UsersService password reset state', () => {
  let mongo: Awaited<ReturnType<typeof start_mongo>>;
  let module_ref: Awaited<
    ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>
  >;
  let service: UsersService;
  let model: Model<User>;
  let user_a: string;
  let user_b: string;

  beforeAll(async () => {
    mongo = await start_mongo();
    module_ref = await Test.createTestingModule({
      imports: [
        mongoose_test_module(mongo.uri),
        MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
      ],
      providers: [UsersService],
    }).compile();
    service = module_ref.get(UsersService);
    model = module_ref.get(getModelToken(User.name));
    await model.init();
  }, 120000);

  afterAll(async () => {
    await module_ref?.close();
    await mongo?.stop();
  });

  beforeEach(async () => {
    await model.deleteMany({});
    user_a = (
      await service.create_user({
        email: 'a@x.com',
        password_hash: 'old-a',
        display_name: null,
      })
    ).id;
    user_b = (
      await service.create_user({
        email: 'b@x.com',
        password_hash: 'old-b',
        display_name: null,
      })
    ).id;
  });

  const future = () => new Date(Date.now() + 60_000);

  it('defaults password_reset to null', async () => {
    const doc = await service.find_by_id(user_a);
    expect(doc!.password_reset).toBeNull();
  });

  it('save_password_reset replaces earlier state and affects only that user', async () => {
    await service.save_password_reset(user_a, 'hash-1', future());
    await service.save_password_reset(user_a, 'hash-2', future());
    const a = await service.find_by_id(user_a);
    const b = await service.find_by_id(user_b);
    expect(a!.password_reset!.otp_hash).toBe('hash-2');
    expect(a!.password_reset!.attempts).toBe(0);
    expect(b!.password_reset).toBeNull();
  });

  it('record_failed_otp counts attempts and clears state at the limit', async () => {
    await service.save_password_reset(user_a, 'hash', future());
    await service.record_failed_otp(user_a, MAX_ATTEMPTS);
    expect((await service.find_by_id(user_a))!.password_reset!.attempts).toBe(
      1,
    );
    for (let i = 1; i < MAX_ATTEMPTS; i++) {
      await service.record_failed_otp(user_a, MAX_ATTEMPTS);
    }
    expect((await service.find_by_id(user_a))!.password_reset).toBeNull();
  });

  it('consume_otp succeeds once and then fails', async () => {
    await service.save_password_reset(user_a, 'hash', future());
    const args = [user_a, 'hash', MAX_ATTEMPTS, new Date()] as const;
    expect(await service.consume_otp(...args, 'token-hash', future())).toBe(
      true,
    );
    expect(await service.consume_otp(...args, 'token-2', future())).toBe(false);
    const doc = await service.find_by_id(user_a);
    expect(doc!.password_reset!.otp_hash).toBeNull();
    expect(doc!.password_reset!.reset_token_hash).toBe('token-hash');
  });

  it('consume_otp fails for a wrong hash, expired OTP or too many attempts', async () => {
    await service.save_password_reset(user_a, 'hash', future());
    expect(
      await service.consume_otp(
        user_a,
        'other',
        MAX_ATTEMPTS,
        new Date(),
        't',
        future(),
      ),
    ).toBe(false);
    expect(
      await service.consume_otp(
        user_a,
        'hash',
        MAX_ATTEMPTS,
        new Date(Date.now() + 120_000),
        't',
        future(),
      ),
    ).toBe(false);
    expect(
      await service.consume_otp(user_a, 'hash', 0, new Date(), 't', future()),
    ).toBe(false);
  });

  it('rotate_reset_token swaps the token hash only while it is live', async () => {
    await service.save_password_reset(user_a, 'hash', future());
    await service.consume_otp(
      user_a,
      'hash',
      MAX_ATTEMPTS,
      new Date(),
      'token-1',
      future(),
    );
    expect(
      await service.rotate_reset_token(
        'token-1',
        'token-2',
        future(),
        new Date(),
      ),
    ).toBe(true);
    expect(
      await service.rotate_reset_token(
        'token-1',
        'token-3',
        future(),
        new Date(),
      ),
    ).toBe(false);
    expect(
      await service.find_by_reset_token_hash('token-2', new Date()),
    ).not.toBeNull();
    expect(
      await service.find_by_reset_token_hash(
        'token-2',
        new Date(Date.now() + 120_000),
      ),
    ).toBeNull();
  });

  it('consume_reset_token sets the password for the token owner only', async () => {
    await service.save_password_reset(user_a, 'hash', future());
    await service.consume_otp(
      user_a,
      'hash',
      MAX_ATTEMPTS,
      new Date(),
      'token-1',
      future(),
    );
    expect(
      await service.consume_reset_token('token-1', new Date(), 'new-hash'),
    ).toBe(user_a);
    expect(
      await service.consume_reset_token('token-1', new Date(), 'again'),
    ).toBeNull();
    const a = await service.find_by_id(user_a);
    const b = await service.find_by_id(user_b);
    expect(a!.password_hash).toBe('new-hash');
    expect(a!.password_reset).toBeNull();
    expect(b!.password_hash).toBe('old-b');
  });
});
