import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BaseRepository } from '../../common/base.repository.js';
import { Topic, TopicDocument } from '../schemas/topic.schema.js';

export type TopicLeanDoc = Topic & { _id: Types.ObjectId };

@Injectable()
export class TopicsRepository extends BaseRepository<TopicDocument> {
  constructor(@InjectModel(Topic.name) model: Model<TopicDocument>) {
    super(model);
  }

  listAllOrdered(): Promise<TopicLeanDoc[]> {
    return this.model
      .find()
      .sort({ order: 1 })
      .lean<TopicLeanDoc[]>()
      .exec();
  }

  findByIdLean(
    topic_id: string | Types.ObjectId,
  ): Promise<TopicLeanDoc | null> {
    return this.model
      .findById(this.toObjectId(topic_id))
      .lean<TopicLeanDoc | null>()
      .exec();
  }

  existsById(topic_id: string | Types.ObjectId) {
    return this.model.exists({ _id: this.toObjectId(topic_id) });
  }
}
