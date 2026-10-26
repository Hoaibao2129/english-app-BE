import type mongoose from 'mongoose';

const TIMESTAMPS = { createdAt: 'created_at', updatedAt: 'updated_at' };

/** Old camelCase field -> new snake_case field, per collection (spec 5.2). */
export const RENAMES: Record<string, Record<string, string>> = {
  topics: {
    nameEn: 'name_en',
    nameVi: 'name_vi',
    wordCount: 'word_count',
    ...TIMESTAMPS,
  },
  words: { topicId: 'topic_id', ...TIMESTAMPS },
  wordprogresses: {
    wordId: 'word_id',
    topicId: 'topic_id',
    lastResult: 'last_result',
    lastAnsweredAt: 'last_answered_at',
    correctCount: 'correct_count',
    wrongCount: 'wrong_count',
    ...TIMESTAMPS,
  },
  answerlogs: {
    wordId: 'word_id',
    topicId: 'topic_id',
    isCorrect: 'is_correct',
    gradedBy: 'graded_by',
    ...TIMESTAMPS,
  },
  gradecaches: {
    wordId: 'word_id',
    normalizedAnswer: 'normalized_answer',
    isCorrect: 'is_correct',
    ...TIMESTAMPS,
  },
};

/**
 * Progress became per-user, so the global unique { word_id: 1 } index would
 * block a second user from answering the same word.
 */
function is_obsolete_index(
  collection: string,
  index: mongoose.mongo.IndexDescription,
): boolean {
  const fields = Object.keys(index.key);
  return (
    collection === 'wordprogresses' &&
    index.name === 'word_id_1' &&
    fields.length === 1 &&
    fields[0] === 'word_id'
  );
}

export type MigrationReport = Record<
  string,
  { matched: number; renamed: number; indexes: string[] }
>;

export async function run_snake_case_migration(
  db: mongoose.mongo.Db,
  options: { confirm: boolean },
): Promise<MigrationReport> {
  const report: MigrationReport = {};

  for (const [name, renames] of Object.entries(RENAMES)) {
    const collection = db.collection(name);
    const has_old = {
      $or: Object.keys(renames).map((old) => ({ [old]: { $exists: true } })),
    };
    const matched = await collection.countDocuments(has_old);

    let existing: mongoose.mongo.IndexDescription[] = [];
    try {
      existing = await collection.indexes();
    } catch (error) {
      // 26 = NamespaceNotFound (collection does not exist yet)
      if ((error as { code?: number }).code !== 26) throw error;
    }
    const old_fields = new Set(Object.keys(renames));
    const stale = existing
      .filter(
        (index) =>
          index.name &&
          index.name !== '_id_' &&
          (Object.keys(index.key).some((field) => old_fields.has(field)) ||
            is_obsolete_index(name, index)),
      )
      .map((index) => index.name as string);
    report[name] = { matched, renamed: 0, indexes: stale };
    if (!options.confirm) continue;

    // Drop old-field indexes first: with a unique index on an old field,
    // renaming would make documents collide on a missing key.
    for (const index_name of stale) await collection.dropIndex(index_name);

    for (const [old, next] of Object.entries(renames)) {
      // Keep a non-null new value and drop the old field; otherwise
      // $rename overwrites the (missing or null) new field with the old value.
      await collection.updateMany(
        { [old]: { $exists: true }, [next]: { $ne: null } },
        { $unset: { [old]: '' } },
      );
      await collection.updateMany(
        { [old]: { $exists: true } },
        { $rename: { [old]: next } },
      );
    }
    report[name].renamed = matched;
  }
  return report;
}
