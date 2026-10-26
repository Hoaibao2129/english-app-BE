import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema.js';
import type { PublicUser } from './auth.types.js';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private readonly users: Model<User>) {}

  create_user(input: {
    email: string;
    password_hash: string;
    display_name: string | null;
  }): Promise<UserDocument> {
    return this.users.create(input);
  }

  find_by_email(email: string): Promise<UserDocument | null> {
    return this.users.findOne({ email: email.trim().toLowerCase() }).exec();
  }

  find_by_id(id: string): Promise<UserDocument | null> {
    if (!isValidObjectId(id)) return Promise.resolve(null);
    return this.users.findById(id).exec();
  }

  count_users(): Promise<number> {
    return this.users.countDocuments().exec();
  }

  to_public(user: UserDocument): PublicUser {
    return {
      id: user._id.toHexString(),
      email: user.email,
      display_name: user.display_name ?? null,
      role: user.role,
    };
  }
}
