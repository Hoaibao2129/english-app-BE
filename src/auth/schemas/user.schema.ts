import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { Role } from '../auth.types.js';

/** Forgot-password tracking, embedded in the user document. */
@Schema({ _id: false, versionKey: false })
export class PasswordResetState {
  @Prop({ type: String, default: null })
  otp_hash: string | null;

  @Prop({ type: Date, default: null })
  otp_expires_at: Date | null;

  @Prop({ type: Number, default: 0 })
  attempts: number;

  @Prop({ type: String, default: null })
  reset_token_hash: string | null;

  @Prop({ type: Date, default: null })
  reset_token_expires_at: Date | null;
}

export const PasswordResetStateSchema =
  SchemaFactory.createForClass(PasswordResetState);

@Schema({
  collection: 'users',
  versionKey: false,
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
})
export class User {
  @Prop({
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  email: string;

  @Prop({ type: String, required: true })
  password_hash: string;

  @Prop({ type: String, default: null })
  display_name: string | null;

  @Prop({ type: String, enum: ['user', 'admin'], default: 'user' })
  role: Role;

  @Prop({ type: PasswordResetStateSchema, default: null })
  password_reset: PasswordResetState | null;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ 'password_reset.reset_token_hash': 1 }, { sparse: true });
