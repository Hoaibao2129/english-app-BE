import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type EnrichmentStatus = 'pending' | 'done' | 'failed' | 'edited';

@Schema({ _id: false })
export class WordExample {
  @Prop({ type: String, required: true })
  en: string;

  @Prop({ type: String, required: true })
  vi: string;
}
const WordExampleSchema = SchemaFactory.createForClass(WordExample);

@Schema({ _id: false })
export class WordEnrichment {
  @Prop({
    type: String,
    enum: ['pending', 'done', 'failed', 'edited'],
    required: true,
    default: 'pending',
  })
  status: EnrichmentStatus;

  @Prop({ type: String, default: null })
  model: string | null;

  @Prop({ type: Date, default: null })
  at: Date | null;
}
const WordEnrichmentSchema = SchemaFactory.createForClass(WordEnrichment);

@Schema({
  collection: 'words',
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class Word {
  @Prop({ type: String, required: true, unique: true })
  key: string;

  @Prop({ type: Types.ObjectId, ref: 'Topic', required: true })
  topic_id: Types.ObjectId;

  @Prop({ type: Number, required: true })
  order: number;

  @Prop({ type: String, required: true })
  en: string;

  @Prop({ type: String, required: true })
  vi: string;

  @Prop({ type: String, default: null })
  ipa: string | null;

  @Prop({ type: String, default: null })
  pos: string | null;

  @Prop({ type: WordExampleSchema, default: null })
  example: WordExample | null;

  @Prop({ type: WordEnrichmentSchema, default: () => ({ status: 'pending' }) })
  enrichment: WordEnrichment;
}

export type WordDocument = HydratedDocument<Word>;
export const WordSchema = SchemaFactory.createForClass(Word);
WordSchema.index({ topic_id: 1, order: 1 });
