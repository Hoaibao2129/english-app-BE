import { Test } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { getModelToken, MongooseModule } from '@nestjs/mongoose';
import { UnauthorizedException } from '@nestjs/common';
import { Model, Types } from 'mongoose';
import {
  mongoose_test_module,
  start_mongo,
} from '../test-utils/mongo-memory.js';
import {
  REUSE_GRACE_MS,
  RefreshTokenService,
} from './refresh-token.service.js';
import {
  RefreshToken,
  RefreshTokenSchema,
} from './schemas/refresh-token.schema.js';

describe('RefreshTokenService', () => {
  let mongo: Awaited<ReturnType<typeof start_mongo>>;
  let module_ref: Awaited<
    ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>
  >;
  let service: RefreshTokenService;
  let model: Model<RefreshToken>;
  const user_id = new Types.ObjectId().toString();

  beforeAll(async () => {
    mongo = await start_mongo();
    module_ref = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_REFRESH_TTL: '1d' })],
        }),
        mongoose_test_module(mongo.uri),
        MongooseModule.forFeature([
          { name: RefreshToken.name, schema: RefreshTokenSchema },
        ]),
      ],
      providers: [RefreshTokenService],
    }).compile();
    service = module_ref.get(RefreshTokenService);
    model = module_ref.get(getModelToken(RefreshToken.name));
    await model.init();
  }, 120000);

  afterAll(async () => {
    await module_ref?.close();
    await mongo?.stop();
  });

  beforeEach(async () => {
    service.now = () => new Date();
    await model.deleteMany({});
  });

  it('stores only sha256 hash (raw token not found in DB)', async () => {
    const raw = await service.create_refresh_token(user_id);
    expect(await model.findOne({ token_hash: raw })).toBeNull();
    const docs = await model.find({}).lean();
    expect(docs).toHaveLength(1);
    expect(docs[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(docs)).not.toContain(raw);
  });

  it('rotate returns new token and old one is revoked with replaced_by', async () => {
    const raw = await service.create_refresh_token(user_id);
    const result = await service.rotate(raw);
    expect(result.user_id).toBe(user_id);
    expect(result.refresh_token).not.toBe(raw);
    const old = await model.findOne({ revoked_at: { $ne: null } });
    expect(old?.replaced_by).toBeTruthy();
    expect(await model.countDocuments({ revoked_at: null })).toBe(1);
  });

  it('rotation keeps the original absolute expires_at', async () => {
    let raw = await service.create_refresh_token(user_id);
    const first = await model.findOne({});
    const original = first!.expires_at.getTime();
    const start = Date.now();
    for (let i = 1; i <= 3; i++) {
      service.now = () => new Date(start + i * 60 * 60 * 1000);
      raw = (await service.rotate(raw)).refresh_token;
    }
    const live = await model.find({ revoked_at: null });
    expect(live).toHaveLength(1);
    expect(live[0].expires_at.getTime()).toBe(original);
  });

  it('rotate of unknown token -> 401', async () => {
    await expect(service.rotate('nope')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rotate of expired token -> 401', async () => {
    const raw = await service.create_refresh_token(user_id);
    service.now = () => new Date(Date.now() + 2 * 24 * 3600 * 1000);
    await expect(service.rotate(raw)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('reuse within 10 s -> 401 and the new token still works', async () => {
    const raw = await service.create_refresh_token(user_id);
    const { refresh_token } = await service.rotate(raw);
    await expect(service.rotate(raw)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.rotate(refresh_token)).resolves.toBeDefined();
  });

  it('reuse after 10 s -> 401 and the new token is revoked too', async () => {
    const raw = await service.create_refresh_token(user_id);
    const { refresh_token } = await service.rotate(raw);
    service.now = () => new Date(Date.now() + REUSE_GRACE_MS + 1000);
    await expect(service.rotate(raw)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(service.rotate(refresh_token)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(await model.countDocuments({ revoked_at: null })).toBe(0);
  });

  it('concurrent rotations of one token: exactly one succeeds', async () => {
    const raw = await service.create_refresh_token(user_id);
    const results = await Promise.allSettled([
      service.rotate(raw),
      service.rotate(raw),
      service.rotate(raw),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('revoke unknown token resolves; revoked token cannot rotate', async () => {
    await expect(service.revoke('unknown')).resolves.toBeUndefined();
    const raw = await service.create_refresh_token(user_id);
    await service.revoke(raw);
    await service.revoke(raw);
    await expect(service.rotate(raw)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
