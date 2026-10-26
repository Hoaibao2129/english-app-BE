import { Test } from '@nestjs/testing';
import { INestApplicationContext } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { getModelToken } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  mongoose_test_module,
  start_mongo,
} from '../../test-utils/mongo-memory.js';
import { VocabularyModule } from '../vocabulary.module.js';
import { SeedService } from './seed.service.js';
import { SourceTopic } from './vocabulary-file.js';
import { Topic } from '../schemas/topic.schema.js';
import { Word } from '../schemas/word.schema.js';
import { WordProgress } from '../schemas/word-progress.schema.js';

const data = (): SourceTopic[] => [
  {
    name_en: 'Time & Calendar',
    name_vi: 'Thời gian',
    words: [
      { en: 'day', vi: 'ngày' },
      { en: 'Week', vi: 'tuần' },
    ],
  },
  {
    name_en: 'Food',
    name_vi: 'Đồ ăn',
    words: [{ en: 'day', vi: 'ngày khác' }],
  },
];

describe('SeedService', () => {
  let mongo: Awaited<ReturnType<typeof start_mongo>>;
  let app: INestApplicationContext;
  let seed: SeedService;
  let topics: Model<Topic>;
  let words: Model<Word>;
  let progress: Model<WordProgress>;

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
    }).compile();
    app = await module_ref.init();
    seed = app.get(SeedService);
    topics = app.get(getModelToken(Topic.name));
    words = app.get(getModelToken(Word.name));
    progress = app.get(getModelToken(WordProgress.name));
    await Promise.all([topics.init(), words.init(), progress.init()]);
  }, 120000);

  afterAll(async () => {
    await app?.close();
    await mongo?.stop();
  });

  beforeEach(async () => {
    await Promise.all([
      topics.deleteMany({}),
      words.deleteMany({}),
      progress.deleteMany({}),
    ]);
  });

  it('rejects duplicate topic slugs without writing', async () => {
    const t = (name_en: string) => ({
      name_en,
      name_vi: 'x',
      words: [{ en: 'a', vi: 'b' }],
    });
    await expect(seed.seed([t('A&B'), t('Food'), t('A B')])).rejects.toThrow(
      /#3 "A B" duplicates slug "a-b" of #1 "A&B"/,
    );
    expect(await topics.countDocuments()).toBe(0);
    expect(await words.countDocuments()).toBe(0);
  });

  it('rejects empty topic slugs without writing', async () => {
    await expect(
      seed.seed([
        { name_en: 'Food', name_vi: 'x', words: [{ en: 'a', vi: 'b' }] },
        { name_en: '日本語', name_vi: 'x', words: [{ en: 'a', vi: 'b' }] },
      ]),
    ).rejects.toThrow(/#2 "日本語" has an empty slug/);
    expect(await topics.countDocuments()).toBe(0);
  });

  it('inserts topics with order 1..n, slug, word_count', async () => {
    const report = await seed.seed(data());
    expect(report.topics).toBe(2);
    const docs = await topics.find().sort({ order: 1 }).lean();
    expect(docs.map((t) => [t.order, t.slug, t.word_count])).toEqual([
      [1, 'time-calendar', 2],
      [2, 'food', 1],
    ]);
    expect(docs[0].name_en).toBe('Time & Calendar');
    expect(docs[0].name_vi).toBe('Thời gian');
  });

  it("inserts words with key, order, enrichment.status 'pending'", async () => {
    await seed.seed(data());
    const topic = await topics.findOne({ slug: 'time-calendar' }).lean();
    const docs = await words
      .find({ topic_id: topic!._id })
      .sort({ order: 1 })
      .lean();
    expect(docs.map((w) => [w.key, w.order, w.enrichment.status])).toEqual([
      ['time-calendar:day', 1, 'pending'],
      ['time-calendar:week', 2, 'pending'],
    ]);
  });

  it('duplicate en in one topic gets keys k, k#2', async () => {
    await seed.seed([
      {
        name_en: 'T',
        name_vi: 'T',
        words: [
          { en: 'run', vi: 'chạy' },
          { en: 'Run', vi: 'điều hành' },
          { en: 'run', vi: 'ba' },
        ],
      },
    ]);
    const keys = (await words.find().sort({ order: 1 }).lean()).map(
      (w) => w.key,
    );
    expect(keys).toEqual(['t:run', 't:run#2', 't:run#3']);
  });

  it('same en in two topics gives two words', async () => {
    await seed.seed(data());
    expect(await words.countDocuments({ en: 'day' })).toBe(2);
  });

  it('re-seed with same data reports unchanged and creates nothing', async () => {
    await seed.seed(data());
    const report = await seed.seed(data());
    expect(report).toEqual({
      topics: 2,
      inserted: 0,
      updated: 0,
      unchanged: 3,
      missing_keys: [],
    });
    expect(await words.countDocuments()).toBe(3);
    expect(await topics.countDocuments()).toBe(2);
  });

  it('re-seed keeps existing WordProgress docs and their word_ids', async () => {
    await seed.seed(data());
    const a = await words.findOne({ key: 'time-calendar:day' }).lean();
    await progress.create({
      user_id: new Types.ObjectId(),
      word_id: a!._id,
      topic_id: a!.topic_id,
      last_result: 'correct',
      last_answered_at: new Date(),
      correct_count: 1,
      wrong_count: 0,
    });
    await seed.seed(data());
    const rows = await progress.find().lean();
    expect(rows).toHaveLength(1);
    expect(String(rows[0].word_id)).toBe(String(a!._id));
    const again = await words.findOne({ key: 'time-calendar:day' }).lean();
    expect(String(again!._id)).toBe(String(a!._id));
  });

  it("changed vi resets enrichment to pending unless status is 'edited'", async () => {
    await seed.seed(data());
    await words.updateOne(
      { key: 'time-calendar:day' },
      { $set: { 'enrichment.status': 'done', ipa: '/deɪ/' } },
    );
    await words.updateOne(
      { key: 'time-calendar:week' },
      { $set: { 'enrichment.status': 'edited' } },
    );
    const changed = data();
    changed[0].words[0].vi = 'ngày (mới)';
    changed[0].words[1].vi = 'tuần lễ';
    const report = await seed.seed(changed);
    expect(report.updated).toBe(2);
    const day = await words.findOne({ key: 'time-calendar:day' }).lean();
    const week = await words.findOne({ key: 'time-calendar:week' }).lean();
    expect(day!.vi).toBe('ngày (mới)');
    expect(day!.enrichment.status).toBe('pending');
    expect(week!.vi).toBe('tuần lễ');
    expect(week!.enrichment.status).toBe('edited');
  });

  it('word removed from file stays in DB and appears in missing_keys', async () => {
    await seed.seed(data());
    const reduced = data();
    reduced[0].words.pop();
    const report = await seed.seed(reduced);
    expect(report.missing_keys).toEqual(['time-calendar:week']);
    expect(await words.countDocuments()).toBe(3);
    const topic = await topics.findOne({ slug: 'time-calendar' }).lean();
    expect(topic!.word_count).toBe(2);
  });
});
