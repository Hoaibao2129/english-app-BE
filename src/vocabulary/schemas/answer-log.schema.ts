import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { Direction, GradedBy, StudyMode } from '../vocabulary.types.js';

@Schema({
  collection: 'answerlogs',
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class AnswerLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Word', required: true })
  word_id: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Topic', required: true })
  topic_id: Types.ObjectId;

  @Prop({ type: String, enum: ['flashcard', 'quiz', 'review'], required: true })
  mode: StudyMode;

  @Prop({ type: String, enum: ['en_vi', 'vi_en'], required: true })
  direction: Direction;

  @Prop({ type: String, default: '' })
  answer: string;

  @Prop({ type: Boolean, default: null })
  is_correct: boolean | null;

  @Prop({
    type: String,
    enum: ['exact', 'cache', 'ai', 'skipped', 'ungraded'],
    required: true,
  })
  graded_by: GradedBy;

  @Prop({ type: Date, required: true, default: () => new Date() })
  at: Date;
}

export type AnswerLogDocument = HydratedDocument<AnswerLog>;
export const AnswerLogSchema = SchemaFactory.createForClass(AnswerLog);
AnswerLogSchema.index({ user_id: 1, at: -1 });
AnswerLogSchema.index({ user_id: 1, word_id: 1, at: -1 });
