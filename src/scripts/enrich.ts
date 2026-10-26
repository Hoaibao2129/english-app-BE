import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { EnrichService } from '../vocabulary/enrich/enrich.service.js';

async function main(): Promise<number> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const report = await app.get(EnrichService).enrich_pending();
    if (report.skipped) {
      console.log('GROQ_API_KEY not set, skipped');
    } else {
      console.log(`done: ${report.done}, failed: ${report.failed}`);
    }
  } finally {
    await app.close();
  }
  return 0;
}

process.exitCode = await main();
