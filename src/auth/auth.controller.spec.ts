import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import {
  mongoose_test_module,
  start_mongo,
} from '../test-utils/mongo-memory.js';
import { AuthModule } from './auth.module.js';
import { MailService } from '../mail/mail.service.js';

const SECRET = 'x'.repeat(32);

describe('AuthController', () => {
  let mongo: Awaited<ReturnType<typeof start_mongo>>;
  let app: INestApplication;
  let access_token: string;
  let user_id: string;

  beforeAll(async () => {
    mongo = await start_mongo();
    const module_ref = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_SECRET: SECRET, JWT_ACCESS_TTL: '15m' })],
        }),
        mongoose_test_module(mongo.uri),
        AuthModule,
      ],
    }).compile();
    app = module_ref.createNestApplication();
    await app.init();
  }, 120000);

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  const post = (path: string, body: unknown) =>
    request(app.getHttpServer())
      .post(path)
      .send(body as object);
  const me = (header?: string) => {
    const req = request(app.getHttpServer()).get('/auth/me');
    return header ? req.set('Authorization', header) : req;
  };

  it('POST /auth/register 201 returns tokens and user', async () => {
    const res = await post('/auth/register', {
      email: 'Me@Example.com',
      password: 'password1',
      display_name: 'Me',
    }).expect(201);
    expect(res.body.access_token).toEqual(expect.any(String));
    expect(res.body.refresh_token).toEqual(expect.any(String));
    expect(res.body.user.email).toBe('me@example.com');
    expect(res.body.user.password_hash).toBeUndefined();
    access_token = res.body.access_token;
    user_id = res.body.user.id;
  });

  it('POST /auth/register rejects bad input with 400', async () => {
    await post('/auth/register', {
      email: 'nope',
      password: 'password1',
    }).expect(400);
    await post('/auth/register', { email: 'a@b.co', password: 'short' }).expect(
      400,
    );
    await post('/auth/register', {
      email: 'a@b.co',
      password: 'a'.repeat(73),
    }).expect(400);
    await post('/auth/register', {
      email: 'a@b.co',
      password: 'password1',
      display_name: 5,
    }).expect(400);
    await post('/auth/register', null).expect(400);
  });

  it('POST /auth/register duplicate gives 409', async () => {
    await post('/auth/register', {
      email: 'me@example.com',
      password: 'password1',
    }).expect(409);
  });

  it('POST /auth/login 200, and 401 on wrong password', async () => {
    const res = await post('/auth/login', {
      email: 'ME@example.com',
      password: 'password1',
    }).expect(200);
    expect(res.body.user.id).toBe(user_id);
    await post('/auth/login', {
      email: 'me@example.com',
      password: 'wrongpass1',
    }).expect(401);
  });

  it('GET /auth/me without header -> 401', async () => {
    await me().expect(401);
  });

  it('GET /auth/me with malformed token -> 401', async () => {
    await me('Bearer not-a-jwt').expect(401);
    await me('Basic abc').expect(401);
  });

  it('GET /auth/me with token signed by another secret -> 401', async () => {
    const other = new JwtService({ secret: 'y'.repeat(32) });
    const token = await other.signAsync({
      sub: user_id,
      email: 'me@example.com',
      role: 'user',
    });
    await me(`Bearer ${token}`).expect(401);
  });

  it('GET /auth/me with expired token -> 401', async () => {
    const jwt = new JwtService({ secret: SECRET });
    const token = await jwt.signAsync({
      sub: user_id,
      email: 'me@example.com',
      role: 'user',
      exp: Math.floor(Date.now() / 1000) - 60,
    });
    await me(`Bearer ${token}`).expect(401);
  });

  it('GET /auth/me with valid token -> PublicUser', async () => {
    const res = await me(`Bearer ${access_token}`).expect(200);
    expect(res.body).toEqual({
      id: user_id,
      email: 'me@example.com',
      display_name: 'Me',
      role: 'user',
    });
  });

  it('refresh -> new pair, second use of old -> 401', async () => {
    const login = await post('/auth/login', {
      email: 'me@example.com',
      password: 'password1',
    }).expect(200);
    const old = login.body.refresh_token;
    const res = await post('/auth/refresh', { refresh_token: old }).expect(200);
    expect(res.body.access_token).toEqual(expect.any(String));
    expect(res.body.refresh_token).not.toBe(old);
    await post('/auth/refresh', { refresh_token: old }).expect(401);
    await post('/auth/refresh', {
      refresh_token: res.body.refresh_token,
    }).expect(200);
  });

  it('logout -> 204 then refresh with that token -> 401', async () => {
    const login = await post('/auth/login', {
      email: 'me@example.com',
      password: 'password1',
    }).expect(200);
    const token = login.body.refresh_token;
    await post('/auth/logout', { refresh_token: token }).expect(204);
    await post('/auth/refresh', { refresh_token: token }).expect(401);
    await post('/auth/logout', { refresh_token: 'unknown' }).expect(204);
  });

  it('refresh/logout with non-string refresh_token -> 400', async () => {
    await post('/auth/refresh', { refresh_token: 5 }).expect(400);
    await post('/auth/logout', {}).expect(400);
  });

  describe('forgot password routes', () => {
    let last_text = '';

    beforeAll(() => {
      app.get(MailService, { strict: false }).transport = {
        sendMail: (message) => {
          last_text = message.text;
          return Promise.resolve({});
        },
      };
    });

    it('POST /auth/forgot-password 404 for an unknown email, 400 for a bad one', async () => {
      const res = await post('/auth/forgot-password', {
        email: 'nobody@example.com',
      }).expect(404);
      expect(res.body.message).toBe('Email is not registered');
      await post('/auth/forgot-password', { email: 'bad' }).expect(400);
    });

    it('runs the full flow without authentication and requires a new login', async () => {
      const sent = await post('/auth/forgot-password', {
        email: 'me@example.com',
      }).expect(200);
      expect(sent.body).toEqual({
        message: 'OTP sent',
        expires_in_seconds: 300,
      });
      const otp = /\d{6}/.exec(last_text)![0];

      await post('/auth/forgot-password/verify', {
        email: 'me@example.com',
        otp: '12',
      }).expect(400);
      const verified = await post('/auth/forgot-password/verify', {
        email: 'me@example.com',
        otp,
      }).expect(200);
      expect(verified.body.expires_in_seconds).toBe(300);

      const mismatch = await post('/auth/reset-password', {
        reset_token: verified.body.reset_token,
        new_password: 'newpassword1',
        confirm_password: 'other-password',
      }).expect(400);
      expect(mismatch.body.reset_token).toEqual(expect.any(String));

      await post('/auth/reset-password', {
        reset_token: mismatch.body.reset_token,
        new_password: 'newpassword1',
        confirm_password: 'newpassword1',
      }).expect(200, { message: 'Password reset successfully' });

      await post('/auth/reset-password', {
        reset_token: mismatch.body.reset_token,
        new_password: 'newpassword1',
        confirm_password: 'newpassword1',
      }).expect(401);
      await post('/auth/login', {
        email: 'me@example.com',
        password: 'password1',
      }).expect(401);
      await post('/auth/login', {
        email: 'me@example.com',
        password: 'newpassword1',
      }).expect(200);
    });
  });
});
