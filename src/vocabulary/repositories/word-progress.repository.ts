import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BaseRepository } from '../../common/base.repository.js';
import {
  WordProgress,
  WordProgressDocument,
} from '../schemas/word-progress.schema.js';
import type { Direction } from '../vocabulary.dto.js';

export interface TopicCountsAggregateRow {
  _id: { topic_id: Types.ObjectId; last_result: 'correct' | 'wrong' };
  n: number;
}

@Injectable()
export class WordProgressRepository extends BaseRepository<WordProgressDocument> {
  constructor(
    @InjectModel(WordProgress.name) model: Model<WordProgressDocument>,
  ) {
    super(model);
  }

  listForTopic(
    user_id: string | Types.ObjectId,
    topic_id: string | Types.ObjectId,
    direction: Direction,
  ): Promise<WordProgress[]> {
    return this.model
      .find({
        user_id: this.toObjectId(user_id),
        topic_id: this.toObjectId(topic_id),
        direction,
      })
      .lean()
      .exec();
  }

  async upsertProgress(
    user_id: string | Types.ObjectId,
    word_id: string | Types.ObjectId,
    topic_id: string | Types.ObjectId,
    direction: Direction,
    is_correct: boolean,
    at: Date,
  ): Promise<void> {
    await this.model
      .updateOne(
        {
          user_id: this.toObjectId(user_id),
          word_id: this.toObjectId(word_id),
          direction,
        },
        {
          $set: {
            last_result: is_correct ? 'correct' : 'wrong',
            last_answered_at: at,
            topic_id: this.toObjectId(topic_id),
          },
          $inc: is_correct ? { correct_count: 1 } : { wrong_count: 1 },
        },
        { upsert: true },
      )
      .exec();
  }

  async deleteForScope(scope: {
    user_id: Types.ObjectId;
    topic_id?: Types.ObjectId;
    direction?: Direction;
  }): Promise<void> {
    await this.model.deleteMany(scope).exec();
  }

  aggregateTopicCounts(
    user_id: string | Types.ObjectId,
    direction: Direction,
  ): Promise<TopicCountsAggregateRow[]> {
    return this.model.aggregate<TopicCountsAggregateRow>([
      {
        $match: {
          user_id: this.toObjectId(user_id),
          direction,
        },
      },
      {
        $group: {
          _id: { topic_id: '$topic_id', last_result: '$last_result' },
          n: { $sum: 1 },
        },
      },
    ]);
  }
}
