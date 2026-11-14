import mongoose from 'mongoose';
import { start_mongo } from '../test-utils/mongo-memory.js';
import { run_progress_direction_migration } from './progress-direction.migration.js';

const { ObjectId } = mongoose.Types;

describe('run_progress_direction_migration', () => {
  let mongo: Awaited<ReturnType<typeof start_mongo>>;
  let connection: mongoose.Connection;
  let db: mongoose.mongo.Db;
  const user_a = new ObjectId();
  const user_b = new ObjectId();
  const word = new ObjectId();
  const other_word = new ObjectId();
  const topic = new ObjectId();
  const t = (n: number) => new Date(Date.UTC(2026, 0, 1, 0, n));

  const progress = () => db.collection('wordprogresses');
  const log = (
    user_id: mongoose.Types.ObjectId,
    direction: 'en_vi' | 'vi_en',
    is_correct: boolean | null,
    minute: number,
    word_id = word,
  ) => ({
    user_id,
    word_id,
    topic_id: topic,
    mode: 'quiz',
    direction,
    answer: 'x',
    is_correct,
    graded_by: is_correct === null ? 'ungraded' : 'exact',
    at: t(minute),
  });

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
    await progress().createIndex({ user_id: 1, word_id: 1 }, { unique: true });
    await progress().createIndex({ user_id: 1, topic_id: 1, last_result: 1 });
    await progress().insertMany([
      {
        user_id: user_a,
        word_id: word,
        topic_id: topic,
        last_result: 'correct',
        last_answered_at: t(9),
        correct_count: 9,
        wrong_count: 9,
      },
      {
        user_id: user_a,
        word_id: other_word,
        topic_id: topic,
        last_result: 'wrong',
        last_answered_at: t(1),
        correct_count: 0,
        wrong_count: 3,
      },
    ]);
    await db
      .collection('answerlogs')
      .insertMany([
        log(user_a, 'en_vi', false, 1),
        log(user_a, 'en_vi', true, 3),
        log(user_a, 'vi_en', true, 2),
        log(user_a, 'vi_en', false, 4),
        log(user_a, 'vi_en', null, 5),
        log(user_a, 'en_vi', null, 6, other_word),
        log(user_b, 'vi_en', true, 7),
      ]);
  });

  it('dry run reports counts and writes nothing', async () => {
    const report = await run_progress_direction_migration(db, {
      confirm: false,
    });
    expect(report).toEqual({
      legacy_rows: 2,
      rebuilt_rows: 1,
      created_rows: 2,
      defaulted_rows: 1,
      legacy_indexes: [
        'user_id_1_word_id_1',
        'user_id_1_topic_id_1_last_result_1',
      ],
      dropped_indexes: [],
    });
    expect(
      await progress().countDocuments({ direction: { $exists: true } }),
    ).toBe(0);
    expect(await progress().indexExists('user_id_1_word_id_1')).toBe(true);
  });

  it('confirm splits a row by direction with counts rebuilt from graded logs', async () => {
    await run_progress_direction_migration(db, { confirm: true });
    const rows = await progress()
      .find({ user_id: user_a, word_id: word })
      .sort({ direction: 1 })
      .toArray();
    expect(
      rows.map((r) => [
        r.direction,
        r.last_result,
        r.last_answered_at,
        r.correct_count,
        r.wrong_count,
        String(r.topic_id),
      ]),
    ).toEqual([
      ['en_vi', 'correct', t(3), 1, 1, String(topic)],
      ['vi_en', 'wrong', t(4), 1, 1, String(topic)],
    ]);
  });

  it('confirm defaults a row without graded logs to en_vi and keeps its counts', async () => {
    await run_progress_direction_migration(db, { confirm: true });
    const rows = await progress().find({ word_id: other_word }).toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      direction: 'en_vi',
      last_result: 'wrong',
      wrong_count: 3,
    });
  });

  it('does not use logs of another user', async () => {
    await run_progress_direction_migration(db, { confirm: true });
    expect(await progress().countDocuments({ user_id: user_b })).toBe(0);
    const vi_en = await progress().findOne({
      user_id: user_a,
      word_id: word,
      direction: 'vi_en',
    });
    expect(vi_en?.correct_count).toBe(1);
  });

  it('confirm drops the legacy indexes', async () => {
    const report = await run_progress_direction_migration(db, {
      confirm: true,
    });
    expect(report.dropped_indexes).toEqual([
      'user_id_1_word_id_1',
      'user_id_1_topic_id_1_last_result_1',
    ]);
    expect(await progress().indexExists('user_id_1_word_id_1')).toBe(false);
  });

  it('second confirmed run changes nothing', async () => {
    await run_progress_direction_migration(db, { confirm: true });
    const before = await progress().find().sort({ _id: 1 }).toArray();
    const report = await run_progress_direction_migration(db, {
      confirm: true,
    });
    expect(report).toEqual({
      legacy_rows: 0,
      rebuilt_rows: 0,
      created_rows: 0,
      defaulted_rows: 0,
      legacy_indexes: [],
      dropped_indexes: [],
    });
    expect(await progress().find().sort({ _id: 1 }).toArray()).toEqual(before);
  });

  it('works when the collections do not exist', async () => {
    for (const c of await db.collections()) await c.drop();
    const report = await run_progress_direction_migration(db, {
      confirm: true,
    });
    expect(report.legacy_rows).toBe(0);
    expect(report.dropped_indexes).toEqual([]);
  });
});
