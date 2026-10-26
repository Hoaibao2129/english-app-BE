import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AnswerLog } from '../vocabulary/schemas/answer-log.schema.js';
import { WordProgress } from '../vocabulary/schemas/word-progress.schema.js';

/**
 * Lives in AuthModule (not ProgressService) so AuthModule never has to import
 * VocabularyModule, which already imports AuthModule for the guard.
 */
@Injectable()
export class LegacyProgressService {
  constructor(
    @InjectModel(WordProgress.name)
    private readonly progress: Model<WordProgress>,
    @InjectModel(AnswerLog.name) private readonly logs: Model<AnswerLog>,
  ) {}

  /** Assigns progress/log rows that predate accounts to the given user. */
  async claim_legacy_progress(
    user_id: string,
  ): Promise<{ progress: number; logs: number }> {
    const owner = new Types.ObjectId(user_id);
    const filter = { user_id: { $exists: false } };
    const [progress, logs] = await Promise.all([
      this.progress.collection.updateMany(filter, { $set: { user_id: owner } }),
      this.logs.collection.updateMany(filter, { $set: { user_id: owner } }),
    ]);
    return { progress: progress.modifiedCount, logs: logs.modifiedCount };
  }
}
