import type mongoose from 'mongoose';

type ObjectId = mongoose.mongo.ObjectId;
type Direction = 'en_vi' | 'vi_en';

/** Indexes created before progress was split by direction. */
export const LEGACY_PROGRESS_INDEXES = [
  'user_id_1_word_id_1',
  'user_id_1_topic_id_1_last_result_1',
] as const;

export interface ProgressDirectionReport {
  legacy_rows: number;
  rebuilt_rows: number;
  created_rows: number;
  defaulted_rows: number;
  legacy_indexes: string[];
  dropped_indexes: string[];
}

interface DirectionStats {
  direction: Direction;
  correct_count: number;
  wrong_count: number;
  last_is_correct: boolean;
  last_at: Date;
}

const stats_key = (
  user_id: ObjectId | null | undefined,
  word_id: ObjectId,
): string => `${user_id ? user_id.toHexString() : ''}|${word_id.toHexString()}`;

/**
 * Splits wordprogresses rows without a direction into one row per direction,
 * rebuilt from graded answerlogs. Rows with no graded log default to en_vi.
 * Safe to re-run: only rows still missing a direction are touched.
 */
export async function run_progress_direction_migration(
  db: mongoose.mongo.Db,
  options: { confirm: boolean },
): Promise<ProgressDirectionReport> {
  const progress = db.collection('wordprogresses');
  const logs = db.collection('answerlogs');

  const legacy_rows = await progress
    .find({ direction: { $exists: false } })
    .toArray();
  const stats = await load_direction_stats(logs);

  const existing_indexes = await progress
    .listIndexes()
    .toArray()
    .then((ix) => ix.map((i) => String(i.name)))
    .catch(() => [] as string[]);
  const legacy_indexes = LEGACY_PROGRESS_INDEXES.filter((name) =>
    existing_indexes.includes(name),
  );
  const dropped_indexes: string[] = [];
  if (options.confirm) {
    for (const name of legacy_indexes) {
      await progress.dropIndex(name);
      dropped_indexes.push(name);
    }
  }

  const report: ProgressDirectionReport = {
    legacy_rows: legacy_rows.length,
    rebuilt_rows: 0,
    created_rows: 0,
    defaulted_rows: 0,
    legacy_indexes,
    dropped_indexes,
  };

  for (const row of legacy_rows) {
    const per_direction = row.user_id
      ? stats.get(stats_key(row.user_id, row.word_id))
      : undefined;

    if (!per_direction) {
      report.defaulted_rows++;
      if (options.confirm) {
        await progress.updateOne(
          { _id: row._id },
          { $set: { direction: 'en_vi' } },
        );
      }
      continue;
    }

    report.rebuilt_rows++;
    report.created_rows += per_direction.length;
    if (!options.confirm) continue;

    const now = new Date();
    for (const s of per_direction) {
      await progress.updateOne(
        { user_id: row.user_id, word_id: row.word_id, direction: s.direction },
        {
          $set: {
            topic_id: row.topic_id,
            last_result: s.last_is_correct ? 'correct' : 'wrong',
            last_answered_at: s.last_at,
            correct_count: s.correct_count,
            wrong_count: s.wrong_count,
            updated_at: now,
          },
          $setOnInsert: { created_at: row.created_at ?? now },
        },
        { upsert: true },
      );
    }
    await progress.deleteOne({ _id: row._id });
  }

  return report;
}

async function load_direction_stats(
  logs: mongoose.mongo.Collection,
): Promise<Map<string, DirectionStats[]>> {
  const rows = await logs
    .aggregate<{
      _id: { user_id?: ObjectId; word_id: ObjectId; direction: Direction };
      correct_count: number;
      wrong_count: number;
      last_is_correct: boolean;
      last_at: Date;
    }>([
      { $match: { is_correct: { $in: [true, false] } } },
      { $sort: { at: 1, _id: 1 } },
      {
        $group: {
          _id: {
            user_id: '$user_id',
            word_id: '$word_id',
            direction: '$direction',
          },
          correct_count: { $sum: { $cond: ['$is_correct', 1, 0] } },
          wrong_count: { $sum: { $cond: ['$is_correct', 0, 1] } },
          last_is_correct: { $last: '$is_correct' },
          last_at: { $last: '$at' },
        },
      },
    ])
    .toArray();

  const map = new Map<string, DirectionStats[]>();
  for (const r of rows) {
    const key = stats_key(r._id.user_id, r._id.word_id);
    const list = map.get(key) ?? [];
    list.push({
      direction: r._id.direction,
      correct_count: r.correct_count,
      wrong_count: r.wrong_count,
      last_is_correct: r.last_is_correct,
      last_at: r.last_at,
    });
    map.set(key, list);
  }
  return map;
}
