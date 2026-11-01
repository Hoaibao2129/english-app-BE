import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { jest } from '@jest/globals';
import request from 'supertest';
import { Types } from 'mongoose';
import {
  mongoose_test_module,
  start_mongo,
} from '../test-utils/mongo-memory.js';
import { VocabularyModule } from './vocabulary.module.js';
import { SeedService } from './seed/seed.service.js';
import { AnswerGrader } from './grading/answer-grader.service.js';
import { Word } from './schemas/word.schema.js';
import { TokenService } from '../auth/token.service.js';
import { WordProgress } from './schemas/word-progress.schema.js';

describe('VocabularyController', () => {
  let mongo: Awaited<ReturnType<typeof start_mongo>>;
  let app: INestApplication;
  let word_id: string;
  let token_a: string;
  let token_b: string;
  const id_a = new Types.ObjectId().toHexString();
  const id_b = new Types.ObjectId().toHexString();
  const grade = jest.fn<(...a: any[]) => Promise<any>>();

  beforeAll(async () => {
    mongo = await start_mongo();
    const module_ref = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ JWT_SECRET: 'x'.repeat(32) })],
        }),
        mongoose_test_module(mongo.uri),
        VocabularyModule,
      ],
    })
      .overrideProvider(AnswerGrader)
      .useValue({ grade })
      .compile();
    app = module_ref.createNestApplication();
    await app.init();
    await app.get(SeedService).seed([
      {
        name_en: 'Time',
        name_vi: 'Thời gian',
        words: [{ en: 'day', vi: 'ngày' }],
      },
    ]);
    const w = await app
      .get(getModelToken(Word.name))
      .findOne({ en: 'day' })
      .lean();
    word_id = String((w as any)._id);
    const tokens = app.get(TokenService);
    token_a = await tokens.sign_access_token({
      user_id: id_a,
      email: 'a@x.com',
      role: 'user',
    });
    token_b = await tokens.sign_access_token({
      user_id: id_b,
      email: 'b@x.com',
      role: 'user',
    });
  }, 120000);

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  const post = (body: unknown) =>
    request(app.getHttpServer())
      .post('/vocabulary/answers')
      .set('Authorization', `Bearer ${token_a}`)
      .send(body as object);
  const get = (path: string, token: string = token_a) =>
    request(app.getHttpServer())
      .get(path)
      .set('Authorization', `Bearer ${token}`);

  it('every /vocabulary route without token gives 401', async () => {
    const http = app.getHttpServer();
    const topic = String(new Types.ObjectId());
    await request(http).get('/vocabulary/topics').expect(401);
    await request(http).get(`/vocabulary/topics/${topic}`).expect(401);
    await request(http)
      .post('/vocabulary/answers')
      .send({ word_id, direction: 'en_vi', mode: 'quiz', answer: 'x' })
      .expect(401);
    await request(http).get('/vocabulary/summary').expect(401);
    await request(http).delete('/vocabulary/progress').expect(401);
    await request(http).get(`/vocabulary/topics/${topic}/review`).expect(401);
    await request(http)
      .delete(`/vocabulary/topics/${topic}/progress`)
      .expect(401);
    await request(http)
      .get('/vocabulary/topics')
      .set('Authorization', 'Bearer garbage')
      .expect(401);
  });

  it('POST answers {word_id:"abc"} → 400', async () => {
    await post({
      word_id: 'abc',
      direction: 'en_vi',
      mode: 'quiz',
      answer: 'x',
    }).expect(400);
  });

  it('unknown valid ObjectId → 404', async () => {
    await post({
      word_id: String(new Types.ObjectId()),
      direction: 'en_vi',
      mode: 'quiz',
      answer: 'x',
    }).expect(404);
  });

  it('missing direction → 400', async () => {
    const res = await post({ word_id, mode: 'quiz', answer: 'x' }).expect(400);
    expect(JSON.stringify(res.body)).toContain('direction');
  });

  it('rejects bad mode, non-string and overlong answer → 400', async () => {
    await post({
      word_id,
      direction: 'en_vi',
      mode: 'nope',
      answer: 'x',
    }).expect(400);
    await post({ word_id, direction: 'en_vi', mode: 'quiz', answer: 5 }).expect(
      400,
    );
    await post({
      word_id,
      direction: 'en_vi',
      mode: 'quiz',
      answer: 'a'.repeat(201),
    }).expect(400);
    await post(undefined).expect(400);
  });

  it('GET /vocabulary/topics/abc → 400', async () => {
    await get('/vocabulary/topics/abc').expect(400);
  });

  it('GET topic unknown id → 404', async () => {
    await get(`/vocabulary/topics/${String(new Types.ObjectId())}`).expect(404);
  });

  it('happy path POST returns {is_correct, correct_answer, graded_by} and GETs reflect it', async () => {
    grade.mockResolvedValue({ is_correct: true, graded_by: 'exact' });
    const res = await post({
      word_id,
      direction: 'en_vi',
      mode: 'quiz',
      answer: 'ngày',
    }).expect(200);
    expect(res.body).toEqual({
      is_correct: true,
      correct_answer: 'ngày',
      graded_by: 'exact',
    });
    const topics = await get('/vocabulary/topics').expect(200);
    expect(topics.body[0]).toMatchObject({ correct: 1, status: 'completed' });
    const detail = await get(`/vocabulary/topics/${topics.body[0].id}`).expect(
      200,
    );
    expect(detail.body.words[0].status).toBe('correct');
    const sum = await get('/vocabulary/summary').expect(200);
    expect(sum.body).toEqual({
      total_words: 1,
      learned_words: 1,
      wrong_words: 0,
      not_started: 0,
    });
  });

  it('with token B, data is scoped: B sees nothing and reset keeps A rows', async () => {
    grade.mockResolvedValue({ is_correct: true, graded_by: 'exact' });
    await post({
      word_id,
      direction: 'en_vi',
      mode: 'quiz',
      answer: 'x',
    }).expect(200);
    const b = await get('/vocabulary/topics', token_b).expect(200);
    expect(b.body[0]).toMatchObject({ correct: 0, wrong: 0 });
    await request(app.getHttpServer())
      .delete('/vocabulary/progress')
      .set('Authorization', `Bearer ${token_b}`)
      .expect(204);
    const a = await get('/vocabulary/topics').expect(200);
    expect(a.body[0]).toMatchObject({ correct: 1 });
  });

  it('DELETE /vocabulary/progress → 204', async () => {
    await request(app.getHttpServer())
      .delete('/vocabulary/progress')
      .set('Authorization', `Bearer ${token_a}`)
      .expect(204);
    expect(
      await app.get(getModelToken(WordProgress.name)).countDocuments(),
    ).toBe(0);
  });

  it('review mode is accepted; GET review lists wrong words; DELETE topic progress resets it', async () => {
    const del = (path: string) =>
      request(app.getHttpServer())
        .delete(path)
        .set('Authorization', `Bearer ${token_a}`);
    grade.mockResolvedValue({ is_correct: false, graded_by: 'ai' });
    await post({
      word_id,
      direction: 'en_vi',
      mode: 'review',
      answer: 'x',
    }).expect(200);
    const topic_id = (await get('/vocabulary/topics').expect(200)).body[0].id;
    const review = await get(`/vocabulary/topics/${topic_id}/review`).expect(
      200,
    );
    expect(review.body.words.map((w: any) => w.status)).toEqual(['wrong']);
    await get('/vocabulary/topics/abc/review').expect(400);
    await del('/vocabulary/topics/abc/progress').expect(400);
    await del(
      `/vocabulary/topics/${String(new Types.ObjectId())}/progress`,
    ).expect(404);
    await del(`/vocabulary/topics/${topic_id}/progress`).expect(204);
    const after = await get('/vocabulary/topics').expect(200);
    expect(after.body[0]).toMatchObject({ wrong: 0, status: 'not_started' });
  });
});
