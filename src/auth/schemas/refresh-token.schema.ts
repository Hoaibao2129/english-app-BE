import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({
  collection: 'refresh_tokens',
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class RefreshToken {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  user_id: Types.ObjectId;

  @Prop({ type: String, required: true, unique: true })
  token_hash: string;

  // TTL index: Mongo deletes the document once expires_at has passed.
  @Prop({ type: Date, required: true, index: { expireAfterSeconds: 0 } })
  expires_at: Date;

  @Prop({ type: Date, default: null })
  revoked_at: Date | null;

  @Prop({ type: Types.ObjectId, default: null })
  replaced_by: Types.ObjectId | null;
}

export type RefreshTokenDocument = HydratedDocument<RefreshToken>;
export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
