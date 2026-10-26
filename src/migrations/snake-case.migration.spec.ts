import mongoose from 'mongoose';
import { start_mongo } from '../test-utils/mongo-memory.js';
import { run_snake_case_migration } from './snake-case.migration.js';

describe('snake_case migration', () => {
  let mongo: Awaited<ReturnType<typeof start_mongo>>;
  let connection: mongoose.Connection;
  let db: mongoose.mongo.Db;

  beforeAll(async () => {
    mongo = await start_mongo();
    connection = await mongoose.createConnection(mongo.uri).asPromise();
    db = connection.db!;
  });

  afterAll(async () => {
    await connection.close();
    await mongo.stop();
  });

  beforeEach(async () => {
    for (const c of await db.collections()) await c.drop();
  });

  const at = new Date('2026-01-01T00:00:00Z');

  async function seed_old() {
    const topic = await db.collection('topics').insertOne({
      slug: 't',
      nameEn: 'T',
      nameVi: 'Tv',
      wordCount: 3,
      createdAt: at,
      updatedAt: at,
    });
    const progress = await db.collection('wordprogresses').insertOne({
      wordId: 'w1',
      topicId: 't1',
      lastResult: 'correct',
      lastAnsweredAt: at,
      correctCount: 2,
      wrongCount: 1,
      createdAt: at,
      updatedAt: at,
    });
    await db
      .collection('wordprogresses')
      .createIndex({ wordId: 1 }, { unique: true });
    return { topic, progress };
  }

  it('dry run reports counts and changes nothing', async () => {
    await seed_old();
    const report = await run_snake_case_migration(db, { confirm: false });
    expect(report.topics).toMatchObject({ matched: 1, renamed: 0 });
    expect(report.wordprogresses).toEqual({
      matched: 1,
      renamed: 0,
      indexes: ['wordId_1'],
    });
    expect(report.words).toMatchObject({ matched: 0, renamed: 0 });
    const doc = await db.collection('topics').findOne({});
    expect(doc).toHaveProperty('nameEn', 'T');
    expect(doc).not.toHaveProperty('name_en');
    const keys = (await db.collection('wordprogresses').indexes()).map(
      (i) => i.name,
    );
    expect(keys).toContain('wordId_1');
  });

  it('confirm renames all mapped fields and keeps _id and values', async () => {
    const { topic, progress } = await seed_old();
    const report = await run_snake_case_migration(db, { confirm: true });
    expect(report.topics).toMatchObject({ matched: 1, renamed: 1 });
    const t = await db.collection('topics').findOne({});
    expect(t).toEqual({
      _id: topic.insertedId,
      slug: 't',
      name_en: 'T',
      name_vi: 'Tv',
      word_count: 3,
      created_at: at,
      updated_at: at,
    });
    const p = await db.collection('wordprogresses').findOne({});
    expect(p).toEqual({
      _id: progress.insertedId,
      word_id: 'w1',
      topic_id: 't1',
      last_result: 'correct',
      last_answered_at: at,
      correct_count: 2,
      wrong_count: 1,
      created_at: at,
      updated_at: at,
    });
  });

  it('second confirmed run renames 0', async () => {
    await seed_old();
    await run_snake_case_migration(db, { confirm: true });
    const report = await run_snake_case_migration(db, { confirm: true });
    for (const r of Object.values(report))
      expect(r).toEqual({ matched: 0, renamed: 0, indexes: [] });
  });

  it('drops old camelCase index { wordId: 1 } but keeps _id_', async () => {
    await seed_old();
    await db
      .collection('answerlogs')
      .insertOne({ wordId: 'w', isCorrect: true });
    await db.collection('answerlogs').createIndex({ wordId: 1, at: -1 });
    await run_snake_case_migration(db, { confirm: true });
    const names = (await db.collection('wordprogresses').indexes()).map(
      (i) => i.name,
    );
    expect(names).toEqual(['_id_']);
    const log_names = (await db.collection('answerlogs').indexes()).map(
      (i) => i.name,
    );
    expect(log_names).toEqual(['_id_']);
  });

  it('keeps indexes without old fields', async () => {
    await db.collection('topics').insertOne({ slug: 'a' });
    await db.collection('topics').createIndex({ slug: 1 }, { unique: true });
    await run_snake_case_migration(db, { confirm: true });
    const names = (await db.collection('topics').indexes()).map((i) => i.name);
    expect(names).toEqual(['_id_', 'slug_1']);
  });

  it('already snake_case documents are untouched', async () => {
    await db.collection('words').insertOne({ topic_id: 't1', key: 'k' });
    const report = await run_snake_case_migration(db, { confirm: true });
    expect(report.words).toMatchObject({ matched: 0, renamed: 0 });
    const w = await db.collection('words').findOne({});
    expect(w).toMatchObject({ topic_id: 't1', key: 'k' });
    expect(w).not.toHaveProperty('topicId');
  });

  it('when both old and new fields exist, keeps the new value and drops the old', async () => {
    await db
      .collection('words')
      .insertOne({ topicId: 'old', topic_id: 'new', key: 'k' });
    const report = await run_snake_case_migration(db, { confirm: true });
    expect(report.words).toMatchObject({ matched: 1, renamed: 1 });
    const w = await db.collection('words').findOne({});
    expect(w).toMatchObject({ topic_id: 'new' });
    expect(w).not.toHaveProperty('topicId');
  });

  it('renames docs under unique old-field indexes without colliding', async () => {
    const progress = db.collection('wordprogresses');
    await progress.createIndex({ wordId: 1 }, { unique: true });
    const { insertedIds } = await progress.insertMany([
      { wordId: 'w1', correctCount: 1 },
      { wordId: 'w2', correctCount: 2 },
    ]);
    const cache = db.collection('gradecaches');
    await cache.createIndex(
      { wordId: 1, direction: 1, normalizedAnswer: 1 },
      { unique: true },
    );
    const { insertedIds: cache_ids } = await cache.insertMany([
      {
        wordId: 'w1',
        direction: 'en_vi',
        normalizedAnswer: 'a',
        isCorrect: true,
      },
      {
        wordId: 'w2',
        direction: 'en_vi',
        normalizedAnswer: 'a',
        isCorrect: false,
      },
    ]);

    await run_snake_case_migration(db, { confirm: true });

    const p = await progress.find({}).sort({ word_id: 1 }).toArray();
    expect(p.map((d) => [d._id, d.word_id, d.correct_count])).toEqual([
      [insertedIds[0], 'w1', 1],
      [insertedIds[1], 'w2', 2],
    ]);
    const c = await cache.find({}).sort({ word_id: 1 }).toArray();
    expect(
      c.map((d) => [d._id, d.word_id, d.normalized_answer, d.is_correct]),
    ).toEqual([
      [cache_ids[0], 'w1', 'a', true],
      [cache_ids[1], 'w2', 'a', false],
    ]);
  });

  it('overwrites a null new field with a non-null old value', async () => {
    await db
      .collection('words')
      .insertOne({ topicId: 'old', topic_id: null, key: 'k' });
    await run_snake_case_migration(db, { confirm: true });
    const w = await db.collection('words').findOne({});
    expect(w).toMatchObject({ topic_id: 'old' });
    expect(w).not.toHaveProperty('topicId');
  });

  it('dry run lists indexes that would be dropped and drops none', async () => {
    await db.collection('words').createIndex({ topicId: 1, order: 1 });
    const report = await run_snake_case_migration(db, { confirm: false });
    expect(report.words.indexes).toEqual(['topicId_1_order_1']);
    expect(await db.collection('words').indexes()).toHaveLength(2);
  });

  it('confirmed run drops obsolete unique word_id_1 but keeps _id_', async () => {
    const progress = db.collection('wordprogresses');
    await progress.insertOne({ word_id: 'w1', topic_id: 't' });
    await progress.createIndex({ word_id: 1 }, { unique: true });
    const dry = await run_snake_case_migration(db, { confirm: false });
    expect(dry.wordprogresses.indexes).toEqual(['word_id_1']);
    expect((await progress.indexes()).map((i) => i.name)).toContain(
      'word_id_1',
    );
    await run_snake_case_migration(db, { confirm: true });
    expect((await progress.indexes()).map((i) => i.name)).toEqual(['_id_']);
    const again = await run_snake_case_migration(db, { confirm: true });
    expect(again.wordprogresses.indexes).toEqual([]);
  });
});
