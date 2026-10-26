import mongoose from 'mongoose';
import { start_mongo } from '../test-utils/mongo-memory.js';
import { run_drop_version_key_migration } from './drop-version-key.migration.js';
import { TopicSchema } from '../vocabulary/schemas/topic.schema.js';
import { WordSchema } from '../vocabulary/schemas/word.schema.js';
import { WordProgressSchema } from '../vocabulary/schemas/word-progress.schema.js';
import { AnswerLogSchema } from '../vocabulary/schemas/answer-log.schema.js';
import { GradeCacheSchema } from '../vocabulary/schemas/grade-cache.schema.js';
import { UserSchema } from '../auth/schemas/user.schema.js';
import { RefreshTokenSchema } from '../auth/schemas/refresh-token.schema.js';

describe('drop __v migration', () => {
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
    await db
      .collection('topics')
      .insertMany([{ slug: 'a', __v: 0 }, { slug: 'b' }]);
    await db.collection('users').insertOne({ email: 'x@y.z', __v: 0 });
  });

  it('dry run counts documents with __v and changes nothing', async () => {
    const report = await run_drop_version_key_migration(db, { confirm: false });
    expect(report.topics).toEqual({ matched: 1, removed: 0 });
    expect(report.users).toEqual({ matched: 1, removed: 0 });
    expect(
      await db.collection('topics').countDocuments({ __v: { $exists: true } }),
    ).toBe(1);
  });

  it('confirm removes __v and keeps every other field', async () => {
    const report = await run_drop_version_key_migration(db, { confirm: true });
    expect(report.topics).toEqual({ matched: 1, removed: 1 });
    const topics = await db
      .collection('topics')
      .find()
      .sort({ slug: 1 })
      .toArray();
    expect(topics.map((t) => t.slug)).toEqual(['a', 'b']);
    expect(topics.some((t) => '__v' in t)).toBe(false);
    expect(await db.collection('users').findOne({})).not.toHaveProperty('__v');
  });

  it('second confirmed run removes nothing', async () => {
    await run_drop_version_key_migration(db, { confirm: true });
    const report = await run_drop_version_key_migration(db, { confirm: true });
    expect(Object.values(report).every((r) => r.matched === 0)).toBe(true);
  });

  it('every schema disables the version key', () => {
    for (const schema of [
      TopicSchema,
      WordSchema,
      WordProgressSchema,
      AnswerLogSchema,
      GradeCacheSchema,
      UserSchema,
      RefreshTokenSchema,
    ]) {
      expect(schema.get('versionKey')).toBe(false);
    }
  });
});
