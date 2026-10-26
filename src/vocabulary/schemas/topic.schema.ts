import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({
  collection: 'topics',
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class Topic {
  @Prop({ type: String, required: true, unique: true })
  slug: string;

  @Prop({ type: Number, required: true })
  order: number;

  @Prop({ type: String, required: true })
  name_en: string;

  @Prop({ type: String, required: true })
  name_vi: string;

  @Prop({ type: Number, required: true, default: 0 })
  word_count: number;
}

export type TopicDocument = HydratedDocument<Topic>;
export const TopicSchema = SchemaFactory.createForClass(Topic);
