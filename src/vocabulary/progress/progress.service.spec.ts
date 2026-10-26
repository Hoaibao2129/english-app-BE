import { Test } from '@nestjs/testing';
import { INestApplicationContext } from '@nestjs/common';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { jest } from '@jest/globals';
import { Model, Types } from 'mongoose';
import {
  mongoose_test_module,
  start_mongo,
} from '../../test-utils/mongo-memory.js';
import { VocabularyModule } from '../vocabulary.module.js';
import { SeedService } from '../seed/seed.service.js';
import { AnswerGrader } from '../grading/answer-grader.service.js';
import { ProgressService } from './progress.service.js';
import { Topic } from '../schemas/topic.schema.js';
import { Word } from '../schemas/word.schema.js';
import { WordProgress } from '../schemas/word-progress.schema.js';
import { AnswerLog } from '../schemas/answer-log.schema.js';
import { GradeCache } from '../schemas/grade-cache.schema.js';
import type { GradeResult } from '../vocabulary.types.js';

const data = () => [
  {
    name_en: 'Time',
    name_vi: 'Thời gian',
    words: [
      { en: 'day', vi: 'ngày' },
      { en: 'week', vi: 'tuần' },
    ],
  },
  { name_en: 'Food', name_vi: 'Đồ ăn', words: [{ en: 'rice', vi: 'cơm' }] },
  { name_en: 'Empty', name_vi: 'Trống', words: [] },
];

describe('ProgressService', () => {
  let mongo: Awaited<ReturnType<typeof start_mongo>>;
  let app: INestApplicationContext;
  let service: ProgressService;
  let words: Model<Word>;
  let topics: Model<Topic>;
  let progress: Model<WordProgress>;
  let logs: Model<AnswerLog>;
  let caches: Model<GradeCache>;
  const user_a = new Types.ObjectId().toHexString();
  const user_b = new Types.ObjectId().toHexString();
  const grade = jest.fn<(...a: any[]) => Promise<GradeResult>>();

  const word_id = async (en: string) =>
    String((await words.findOne({ en }).lean())!._id);

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
    app = await module_ref.init();
    service = app.get(ProgressService);
    words = app.get(getModelToken(Word.name));
    topics = app.get(getModelToken(Topic.name));
    progress = app.get(getModelToken(WordProgress.name));
    logs = app.get(getModelToken(AnswerLog.name));
    caches = app.get(getModelToken(GradeCache.name));
    await Promise.all([
      words.init(),
      topics.init(),
      progress.init(),
      logs.init(),
    ]);
  }, 120000);

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  beforeEach(async () => {
    grade.mockReset();
    await Promise.all([
      topics.deleteMany({}),
      words.deleteMany({}),
      progress.deleteMany({}),
      logs.deleteMany({}),
      caches.deleteMany({}),
    ]);
    await app.get(SeedService).seed(data());
  });

  const answer = (
    en: string,
    direction: 'en_vi' | 'vi_en' = 'en_vi',
    user_id: string = user_a,
  ) =>
    word_id(en).then((id) =>
      service.submit_answer(user_id, {
        word_id: id,
        direction,
        mode: 'quiz',
        answer: 'x',
      }),
    );

  it('list_topics counts correct/wrong/not_started per topic, ordered by order', async () => {
    grade.mockResolvedValueOnce({ is_correct: true, graded_by: 'exact' });
    grade.mockResolvedValueOnce({ is_correct: false, graded_by: 'ai' });
    await answer('day');
    await answer('week');
    const list = await service.list_topics(user_a);
    expect(list.map((t) => t.order)).toEqual([1, 2, 3]);
    expect(list[0]).toMatchObject({
      title: 'Time',
      title_vi: 'Thời gian',
      total_words: 2,
      correct: 1,
      wrong: 1,
      not_started: 0,
      status: 'in_progress',
    });
    expect(typeof list[0].id).toBe('string');
    expect(list[1]).toMatchObject({
      total_words: 1,
      correct: 0,
      wrong: 0,
      not_started: 1,
      status: 'not_started',
    });
    expect(list[2].status).toBe('not_started');
  });

  it('marks a topic completed when all words are correct', async () => {
    grade.mockResolvedValue({ is_correct: true, graded_by: 'exact' });
    await answer('rice');
    const list = await service.list_topics(user_a);
    expect(list[1].status).toBe('completed');
  });

  it('same word right then wrong → correct 0, wrong 1', async () => {
    grade.mockResolvedValueOnce({ is_correct: true, graded_by: 'exact' });
    grade.mockResolvedValueOnce({ is_correct: false, graded_by: 'ai' });
    await answer('day');
    await answer('day');
    const t = (await service.list_topics(user_a))[0];
    expect([t.correct, t.wrong]).toEqual([0, 1]);
  });

  it('answering in en_vi then vi_en updates the same progress row', async () => {
    grade.mockResolvedValue({ is_correct: true, graded_by: 'exact' });
    await answer('day', 'en_vi');
    await answer('day', 'vi_en');
    expect(await progress.countDocuments()).toBe(1);
    expect(await logs.countDocuments()).toBe(2);
  });

  it('ungraded answer writes answerlog with is_correct null and leaves progress untouched', async () => {
    grade.mockResolvedValue({ is_correct: null, graded_by: 'ungraded' });
    const r = await answer('day');
    expect(r).toEqual({
      is_correct: null,
      correct_answer: 'ngày',
      graded_by: 'ungraded',
    });
    expect(await progress.countDocuments()).toBe(0);
    const log = await logs.findOne().lean();
    expect(log?.is_correct).toBeNull();
    expect(log?.graded_by).toBe('ungraded');
    const t = (await service.list_topics(user_a))[0];
    expect([t.correct, t.wrong, t.not_started]).toEqual([0, 0, 2]);
  });

  it('skipped answer marks word wrong', async () => {
    grade.mockResolvedValue({ is_correct: false, graded_by: 'skipped' });
    await answer('day');
    const p = await progress.findOne().lean();
    expect(p?.last_result).toBe('wrong');
  });

  it('submit_answer increments correct_count/wrong_count and sets last_answered_at', async () => {
    grade.mockResolvedValueOnce({ is_correct: true, graded_by: 'exact' });
    grade.mockResolvedValueOnce({ is_correct: true, graded_by: 'exact' });
    grade.mockResolvedValueOnce({ is_correct: false, graded_by: 'ai' });
    const before = Date.now();
    await answer('day');
    await answer('day');
    await answer('day');
    const p = await progress.findOne().lean();
    expect([p?.correct_count, p?.wrong_count]).toEqual([2, 1]);
    expect(p!.last_answered_at.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('correct_answer is vi for en_vi and en for vi_en; grader gets topic name_en', async () => {
    grade.mockResolvedValue({ is_correct: true, graded_by: 'exact' });
    expect((await answer('day', 'en_vi')).correct_answer).toBe('ngày');
    expect((await answer('day', 'vi_en')).correct_answer).toBe('day');
    expect(grade.mock.calls[0][0].topic_name).toBe('Time');
  });

  it('summary.learned_words counts last_result correct across topics', async () => {
    grade.mockResolvedValueOnce({ is_correct: true, graded_by: 'exact' });
    grade.mockResolvedValueOnce({ is_correct: true, graded_by: 'exact' });
    grade.mockResolvedValueOnce({ is_correct: false, graded_by: 'ai' });
    await answer('day');
    await answer('rice');
    await answer('week');
    expect(await service.summary(user_a)).toEqual({
      total_words: 3,
      learned_words: 2,
      wrong_words: 1,
      not_started: 0,
    });
  });

  it('reset clears progress and logs, keeps gradecaches', async () => {
    grade.mockResolvedValue({ is_correct: true, graded_by: 'ai' });
    await answer('day');
    await caches.create({
      word_id: new Types.ObjectId(),
      direction: 'en_vi',
      normalized_answer: 'a',
      is_correct: true,
      model: 'm',
    });
    await service.reset(user_a);
    expect(await progress.countDocuments()).toBe(0);
    expect(await logs.countDocuments()).toBe(0);
    expect(await caches.countDocuments()).toBe(1);
  });

  it('get_topic words carry status new/correct/wrong', async () => {
    grade.mockResolvedValueOnce({ is_correct: true, graded_by: 'exact' });
    grade.mockResolvedValueOnce({ is_correct: false, graded_by: 'ai' });
    await answer('day');
    await answer('week');
    const t = (await service.list_topics(user_a))[0];
    const d = await service.get_topic(user_a, t.id);
    expect(d.words.map((w) => [w.word, w.meaning, w.status])).toEqual([
      ['day', 'ngày', 'correct'],
      ['week', 'tuần', 'wrong'],
    ]);
    expect(d.words[0]).toMatchObject({
      pronunciation: null,
      part_of_speech: null,
      example: null,
      example_meaning: null,
    });
    expect(d.total_words).toBe(2);
  });

  it('get_topic throws 400 for invalid id and 404 for missing', async () => {
    await expect(service.get_topic(user_a, 'abc')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(
      service.get_topic(user_a, String(new Types.ObjectId())),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('submit_answer throws 404 for unknown word', async () => {
    await expect(
      service.submit_answer(user_a, {
        word_id: String(new Types.ObjectId()),
        direction: 'en_vi',
        mode: 'quiz',
        answer: 'x',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('user A answers; user B list_topics shows 0 correct / 0 wrong', async () => {
    grade.mockResolvedValue({ is_correct: true, graded_by: 'exact' });
    await answer('day', 'en_vi', user_a);
    const b = await service.list_topics(user_b);
    expect(b.every((t) => t.correct === 0 && t.wrong === 0)).toBe(true);
    expect((await service.summary(user_b)).learned_words).toBe(0);
    const detail = await service.get_topic(user_b, b[0].id);
    expect(detail.words.every((w) => w.status === 'new')).toBe(true);
  });

  it('B reset does not delete A progress', async () => {
    grade.mockResolvedValue({ is_correct: true, graded_by: 'exact' });
    await answer('day', 'en_vi', user_a);
    await answer('day', 'en_vi', user_b);
    await service.reset(user_b);
    expect(await progress.countDocuments()).toBe(1);
    expect(await logs.countDocuments()).toBe(1);
    expect((await service.summary(user_a)).learned_words).toBe(1);
  });

  it('same word answered by A and B gives two progress rows', async () => {
    grade.mockResolvedValue({ is_correct: true, graded_by: 'exact' });
    await answer('day', 'en_vi', user_a);
    await answer('day', 'en_vi', user_b);
    expect(await progress.countDocuments()).toBe(2);
  });
});
