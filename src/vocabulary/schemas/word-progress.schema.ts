import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({
  collection: 'wordprogresses',
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class WordProgress {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Word', required: true })
  word_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Topic', required: true })
  topic_id: Types.ObjectId;

  @Prop({ type: String, enum: ['correct', 'wrong'], required: true })
  last_result: 'correct' | 'wrong';

  @Prop({ type: Date, required: true })
  last_answered_at: Date;

  @Prop({ type: Number, required: true, default: 0 })
  correct_count: number;

  @Prop({ type: Number, required: true, default: 0 })
  wrong_count: number;
}

export type WordProgressDocument = HydratedDocument<WordProgress>;
export const WordProgressSchema = SchemaFactory.createForClass(WordProgress);
WordProgressSchema.index({ user_id: 1, word_id: 1 }, { unique: true });
WordProgressSchema.index({ user_id: 1, topic_id: 1, last_result: 1 });
