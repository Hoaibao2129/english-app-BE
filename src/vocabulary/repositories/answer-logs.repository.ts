import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BaseRepository } from '../../common/base.repository.js';
import { AnswerLog, AnswerLogDocument } from '../schemas/answer-log.schema.js';
import type { Direction, StudyMode } from '../vocabulary.dto.js';
import type { GradedBy } from '../vocabulary.types.js';

@Injectable()
export class AnswerLogsRepository extends BaseRepository<AnswerLogDocument> {
  constructor(@InjectModel(AnswerLog.name) model: Model<AnswerLogDocument>) {
    super(model);
  }

  async createLog(data: {
    user_id: Types.ObjectId;
    word_id: Types.ObjectId;
    topic_id: Types.ObjectId;
    mode: StudyMode;
    direction: Direction;
    answer: string;
    is_correct: boolean | null;
    graded_by: GradedBy;
    at: Date;
  }): Promise<AnswerLogDocument> {
    return this.model.create(data);
  }

  async deleteForScope(scope: {
    user_id: Types.ObjectId;
    topic_id?: Types.ObjectId;
    direction?: Direction;
  }): Promise<void> {
    await this.model.deleteMany(scope).exec();
  }
}
