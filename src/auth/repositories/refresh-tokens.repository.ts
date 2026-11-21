import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { BaseRepository } from '../../common/base.repository.js';
import {
  RefreshToken,
  RefreshTokenDocument,
} from '../schemas/refresh-token.schema.js';

@Injectable()
export class RefreshTokensRepository extends BaseRepository<RefreshTokenDocument> {
  constructor(
    @InjectModel(RefreshToken.name) model: Model<RefreshTokenDocument>,
  ) {
    super(model);
  }

  createToken(data: {
    _id: Types.ObjectId;
    user_id: Types.ObjectId;
    token_hash: string;
    expires_at: Date;
    revoked_at: null;
    replaced_by: null;
  }): Promise<RefreshTokenDocument> {
    return this.model.create(data);
  }

  claimTokenForRotation(
    token_hash: string,
    now: Date,
    next_id: Types.ObjectId,
  ): Promise<RefreshTokenDocument | null> {
    return this.model
      .findOneAndUpdate(
        { token_hash, revoked_at: null, expires_at: { $gt: now } },
        { $set: { revoked_at: now, replaced_by: next_id } },
      )
      .exec();
  }

  findByTokenHash(token_hash: string): Promise<RefreshTokenDocument | null> {
    return this.model.findOne({ token_hash }).exec();
  }

  async revokeAllForUser(
    user_id: Types.ObjectId | string,
    now: Date,
  ): Promise<void> {
    await this.model
      .updateMany(
        { user_id: this.toObjectId(user_id), revoked_at: null },
        { $set: { revoked_at: now } },
      )
      .exec();
  }

  async revokeToken(token_hash: string, now: Date): Promise<void> {
    await this.model
      .updateOne({ token_hash, revoked_at: null }, { $set: { revoked_at: now } })
      .exec();
  }
}
