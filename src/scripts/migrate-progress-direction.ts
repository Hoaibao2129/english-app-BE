import mongoose from 'mongoose';
import { run_progress_direction_migration } from '../migrations/progress-direction.migration.js';

async function main(): Promise<number> {
  try {
    process.loadEnvFile();
  } catch {
    // no .env file: rely on the process environment
  }
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set.');
    return 1;
  }
  const confirm = process.argv.includes('--confirm');

  try {
    await mongoose.connect(uri);
    const report = await run_progress_direction_migration(
      mongoose.connection.db!,
      { confirm },
    );
    console.log(
      confirm
        ? 'Split wordprogresses by direction:'
        : 'DRY RUN (nothing written). Re-run with --confirm to apply:',
    );
    console.log(`  rows without direction: ${report.legacy_rows}`);
    console.log(
      `  rebuilt from answerlogs: ${report.rebuilt_rows} (${report.created_rows} direction rows)`,
    );
    console.log(`  defaulted to en_vi: ${report.defaulted_rows}`);
    console.log(
      `  legacy indexes: ${report.legacy_indexes.join(', ') || 'none'}; dropped: ${report.dropped_indexes.join(', ') || 'none'}`,
    );
    return 0;
  } catch (error) {
    console.error(`Migration failed: ${(error as Error).message}`);
    return 1;
  } finally {
    await mongoose.disconnect();
  }
}

process.exitCode = await main();
