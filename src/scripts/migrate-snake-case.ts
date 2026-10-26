import mongoose from 'mongoose';
import { run_snake_case_migration } from '../migrations/snake-case.migration.js';

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
    const report = await run_snake_case_migration(mongoose.connection.db!, {
      confirm,
    });
    console.log(
      confirm
        ? 'Migration applied:'
        : 'DRY RUN (nothing written). Re-run with --confirm to apply:',
    );
    for (const [name, r] of Object.entries(report)) {
      console.log(`  ${name}: ${r.matched} matched, ${r.renamed} renamed`);
      if (r.indexes.length) {
        console.log(
          `    indexes ${confirm ? 'dropped' : 'to drop'}: ${r.indexes.join(', ')}`,
        );
      }
    }
    return 0;
  } catch (error) {
    console.error(`Migration failed: ${(error as Error).message}`);
    return 1;
  } finally {
    await mongoose.disconnect();
  }
}

process.exitCode = await main();
