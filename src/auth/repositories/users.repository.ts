import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { BaseRepository } from '../../common/base.repository.js';
import { User, UserDocument } from '../schemas/user.schema.js';

@Injectable()
export class UsersRepository extends BaseRepository<UserDocument> {
  constructor(@InjectModel(User.name) model: Model<UserDocument>) {
    super(model);
  }

  createUser(input: {
    email: string;
    password_hash: string;
    display_name: string | null;
  }): Promise<UserDocument> {
    return this.model.create(input);
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.model.findOne({ email: email.trim().toLowerCase() }).exec();
  }

  findByIdString(id: string): Promise<UserDocument | null> {
    if (!isValidObjectId(id)) return Promise.resolve(null);
    return this.model.findById(id).exec();
  }

  async savePasswordReset(
    user_id: string,
    otp_hash: string,
    otp_expires_at: Date,
  ): Promise<void> {
    await this.model
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

  async clearPasswordReset(user_id: string): Promise<void> {
    await this.model
      .updateOne({ _id: user_id }, { $set: { password_reset: null } })
      .exec();
  }

  async recordFailedOtp(
    user_id: string,
    max_attempts: number,
  ): Promise<void> {
    const updated = await this.model
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
      await this.clearPasswordReset(user_id);
    }
  }

  async consumeOtp(
    user_id: string,
    otp_hash: string,
    max_attempts: number,
    now: Date,
    reset_token_hash: string,
    reset_token_expires_at: Date,
  ): Promise<boolean> {
    const updated = await this.model
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

  findByResetTokenHash(
    reset_token_hash: string,
    now: Date,
  ): Promise<UserDocument | null> {
    return this.model
      .findOne({
        'password_reset.reset_token_hash': reset_token_hash,
        'password_reset.reset_token_expires_at': { $gt: now },
      })
      .exec();
  }

  async rotateResetToken(
    old_hash: string,
    new_hash: string,
    new_expires_at: Date,
    now: Date,
  ): Promise<boolean> {
    const updated = await this.model
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

  async consumeResetToken(
    reset_token_hash: string,
    now: Date,
    password_hash: string,
  ): Promise<string | null> {
    const updated = await this.model
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
}
