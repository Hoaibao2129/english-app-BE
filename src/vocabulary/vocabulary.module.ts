import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { AnswerLog, AnswerLogSchema } from './schemas/answer-log.schema.js';
import { GradeCache, GradeCacheSchema } from './schemas/grade-cache.schema.js';
import { Topic, TopicSchema } from './schemas/topic.schema.js';
import {
  WordProgress,
  WordProgressSchema,
} from './schemas/word-progress.schema.js';
import { Word, WordSchema } from './schemas/word.schema.js';
import { GroqService } from './groq/groq.service.js';
import { AnswerGrader } from './grading/answer-grader.service.js';
import { ProgressService } from './progress/progress.service.js';
import { VocabularyController } from './vocabulary.controller.js';
import { SeedService } from './seed/seed.service.js';
import { EnrichService } from './enrich/enrich.service.js';

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Topic.name, schema: TopicSchema },
      { name: Word.name, schema: WordSchema },
      { name: WordProgress.name, schema: WordProgressSchema },
      { name: AnswerLog.name, schema: AnswerLogSchema },
      { name: GradeCache.name, schema: GradeCacheSchema },
    ]),
  ],
  controllers: [VocabularyController],
  providers: [
    SeedService,
    GroqService,
    AnswerGrader,
    ProgressService,
    EnrichService,
  ],
  exports: [SeedService, ProgressService, EnrichService],
})
export class VocabularyModule {}
