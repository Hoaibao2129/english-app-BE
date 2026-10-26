import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import type { Direction } from '../vocabulary.types.js';

@Schema({
  collection: 'gradecaches',
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class GradeCache {
  @Prop({ type: Types.ObjectId, ref: 'Word', required: true })
  word_id: Types.ObjectId;

  @Prop({ type: String, enum: ['en_vi', 'vi_en'], required: true })
  direction: Direction;

  @Prop({ type: String, required: true })
  normalized_answer: string;

  @Prop({ type: Boolean, required: true })
  is_correct: boolean;

  @Prop({ type: String, required: true })
  model: string;
}

export type GradeCacheDocument = HydratedDocument<GradeCache>;
export const GradeCacheSchema = SchemaFactory.createForClass(GradeCache);
GradeCacheSchema.index(
  { word_id: 1, direction: 1, normalized_answer: 1 },
  { unique: true },
);
