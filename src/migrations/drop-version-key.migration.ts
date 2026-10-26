import type mongoose from 'mongoose';

export const VERSIONED_COLLECTIONS = [
  'topics',
  'words',
  'wordprogresses',
  'answerlogs',
  'gradecaches',
  'users',
  'refresh_tokens',
] as const;

export type DropVersionKeyReport = Record<
  string,
  { matched: number; removed: number }
>;

export async function run_drop_version_key_migration(
  db: mongoose.mongo.Db,
  options: { confirm: boolean },
): Promise<DropVersionKeyReport> {
  const report: DropVersionKeyReport = {};
  const filter = { __v: { $exists: true } };

  for (const name of VERSIONED_COLLECTIONS) {
    const collection = db.collection(name);
    const matched = await collection.countDocuments(filter);
    let removed = 0;
    if (options.confirm && matched > 0) {
      const result = await collection.updateMany(filter, {
        $unset: { __v: '' },
      });
      removed = result.modifiedCount;
    }
    report[name] = { matched, removed };
  }

  return report;
}
