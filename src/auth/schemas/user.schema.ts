import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { Role } from '../auth.types.js';

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
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
