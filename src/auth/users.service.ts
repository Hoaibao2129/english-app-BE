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

  /** Replaces any previous forgot-password state with a fresh OTP. */
  async save_password_reset(
    user_id: string,
    otp_hash: string,
    otp_expires_at: Date,
  ): Promise<void> {
    await this.users
      .updateOne(
        { _id: user_id },
        {
          $set: {
            password_reset: {
              otp_hash,
              otp_expires_at,
              attempts: 0,
              reset_token_hash: null,
              reset_token_expires_at: null,
            },
          },
        },
      )
      .exec();
  }

  async clear_password_reset(user_id: string): Promise<void> {
    await this.users
      .updateOne({ _id: user_id }, { $set: { password_reset: null } })
      .exec();
  }

  /** Counts a wrong OTP; clears the state once max_attempts is reached. */
  async record_failed_otp(
    user_id: string,
    max_attempts: number,
  ): Promise<void> {
    const updated = await this.users
      .findOneAndUpdate(
        { _id: user_id, 'password_reset.otp_hash': { $ne: null } },
        { $inc: { 'password_reset.attempts': 1 } },
        { returnDocument: 'after' },
      )
      .exec();
    if (
      updated?.password_reset &&
      updated.password_reset.attempts >= max_attempts
    ) {
      await this.clear_password_reset(user_id);
    }
  }

  /** Atomically swaps a live OTP for a reset token. Returns false if lost. */
  async consume_otp(
    user_id: string,
    otp_hash: string,
    max_attempts: number,
    now: Date,
    reset_token_hash: string,
    reset_token_expires_at: Date,
  ): Promise<boolean> {
    const updated = await this.users
      .findOneAndUpdate(
        {
          _id: user_id,
          'password_reset.otp_hash': otp_hash,
          'password_reset.otp_expires_at': { $gt: now },
          'password_reset.attempts': { $lt: max_attempts },
        },
        {
          $set: {
            'password_reset.otp_hash': null,
            'password_reset.otp_expires_at': null,
            'password_reset.reset_token_hash': reset_token_hash,
            'password_reset.reset_token_expires_at': reset_token_expires_at,
          },
        },
      )
      .exec();
    return updated !== null;
  }

  find_by_reset_token_hash(
    reset_token_hash: string,
    now: Date,
  ): Promise<UserDocument | null> {
    return this.users
      .findOne({
        'password_reset.reset_token_hash': reset_token_hash,
        'password_reset.reset_token_expires_at': { $gt: now },
      })
      .exec();
  }

  /** Atomically replaces a live reset token. Returns false if lost. */
  async rotate_reset_token(
    old_hash: string,
    new_hash: string,
    new_expires_at: Date,
    now: Date,
  ): Promise<boolean> {
    const updated = await this.users
      .findOneAndUpdate(
        {
          'password_reset.reset_token_hash': old_hash,
          'password_reset.reset_token_expires_at': { $gt: now },
        },
        {
          $set: {
            'password_reset.reset_token_hash': new_hash,
            'password_reset.reset_token_expires_at': new_expires_at,
          },
        },
      )
      .exec();
    return updated !== null;
  }

  /**
   * Atomically consumes a live reset token and sets the new password hash.
   * Returns the user id, or null if the token was no longer valid.
   */
  async consume_reset_token(
    reset_token_hash: string,
    now: Date,
    password_hash: string,
  ): Promise<string | null> {
    const updated = await this.users
      .findOneAndUpdate(
        {
          'password_reset.reset_token_hash': reset_token_hash,
          'password_reset.reset_token_expires_at': { $gt: now },
        },
        { $set: { password_hash, password_reset: null } },
      )
      .exec();
    return updated ? updated._id.toHexString() : null;
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
