import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BaseRepository } from '../../common/base.repository.js';
import { Word, WordDocument } from '../schemas/word.schema.js';

export type WordLeanDoc = Word & { _id: Types.ObjectId };

@Injectable()
export class WordsRepository extends BaseRepository<WordDocument> {
  constructor(@InjectModel(Word.name) model: Model<WordDocument>) {
    super(model);
  }

  findByIdLean(
    word_id: string | Types.ObjectId,
  ): Promise<WordLeanDoc | null> {
    return this.model
      .findById(this.toObjectId(word_id))
      .lean<WordLeanDoc | null>()
      .exec();
  }

  listByTopicOrdered(
    topic_id: string | Types.ObjectId,
  ): Promise<WordLeanDoc[]> {
    return this.model
      .find({ topic_id: this.toObjectId(topic_id) })
      .sort({ order: 1 })
      .lean<WordLeanDoc[]>()
      .exec();
  }
}
