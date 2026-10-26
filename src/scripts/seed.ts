import { readFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { SeedService } from '../vocabulary/seed/seed.service.js';
import { parse_vocabulary_file } from '../vocabulary/seed/vocabulary-file.js';

async function main(): Promise<number> {
  const path = process.argv[2] ?? 'data/vocabulary.json';

  let topics;
  try {
    topics = parse_vocabulary_file(JSON.parse(await readFile(path, 'utf8')));
  } catch (error) {
    console.error(`Cannot read ${path}: ${(error as Error).message}`);
    return 1;
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const report = await app.get(SeedService).seed(topics);
    console.log(
      `Seeded ${report.topics} topics: ${report.inserted} inserted, ${report.updated} updated, ${report.unchanged} unchanged.`,
    );
    for (const key of report.missing_keys) {
      console.warn(
        `WARNING: word "${key}" is in the database but not in the file (kept).`,
      );
    }
  } finally {
    await app.close();
  }
  return 0;
}

process.exitCode = await main();
