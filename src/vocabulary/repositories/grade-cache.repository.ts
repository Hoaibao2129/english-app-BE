import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BaseRepository } from '../../common/base.repository.js';
import {
  GradeCache,
  GradeCacheDocument,
} from '../schemas/grade-cache.schema.js';
import type { Direction } from '../vocabulary.dto.js';

@Injectable()
export class GradeCacheRepository extends BaseRepository<GradeCacheDocument> {
  constructor(@InjectModel(GradeCache.name) model: Model<GradeCacheDocument>) {
    super(model);
  }

  findHit(
    word_id: string | Types.ObjectId,
    direction: Direction,
    normalized_answer: string,
  ): Promise<GradeCache | null> {
    return this.model
      .findOne({
        word_id: this.toObjectId(word_id),
        direction,
        normalized_answer,
      })
      .lean()
      .exec();
  }

  async upsertCache(
    word_id: string | Types.ObjectId,
    direction: Direction,
    normalized_answer: string,
    is_correct: boolean,
    model: string,
  ): Promise<void> {
    await this.model
      .updateOne(
        {
          word_id: this.toObjectId(word_id),
          direction,
          normalized_answer,
        },
        { $setOnInsert: { is_correct, model } },
        { upsert: true },
      )
      .exec();
  }
}
