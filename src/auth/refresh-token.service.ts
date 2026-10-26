import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { parse_duration_ms } from '../config/env.validation.js';
import { RefreshToken } from './schemas/refresh-token.schema.js';

export const REUSE_GRACE_MS = 10_000;
const INVALID_REFRESH_TOKEN = 'Invalid refresh token';

function hash_token(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

@Injectable()
export class RefreshTokenService {
  /** Injectable clock so tests can move time without sleeping. */
  now: () => Date = () => new Date();

  constructor(
    @InjectModel(RefreshToken.name)
    private readonly model: Model<RefreshToken>,
    private readonly config: ConfigService,
  ) {}

  private ttl_ms(): number {
    return parse_duration_ms(
      this.config.get<string>('JWT_REFRESH_TTL') ?? '1d',
    );
  }

  private generate() {
    const raw = randomBytes(32).toString('base64url');
    return {
      raw,
      _id: new Types.ObjectId(),
      token_hash: hash_token(raw),
    };
  }

  async create_refresh_token(user_id: string): Promise<string> {
    const { raw, _id, token_hash } = this.generate();
    await this.model.create({
      _id,
      user_id: new Types.ObjectId(user_id),
      token_hash,
      expires_at: new Date(this.now().getTime() + this.ttl_ms()),
      revoked_at: null,
      replaced_by: null,
    });
    return raw;
  }

  async rotate(
    raw: string,
  ): Promise<{ user_id: string; refresh_token: string }> {
    const now = this.now();
    const token_hash = hash_token(raw);
    const next = this.generate();

    // Atomic claim: only one concurrent caller can revoke a live token.
    const claimed = await this.model.findOneAndUpdate(
      { token_hash, revoked_at: null, expires_at: { $gt: now } },
      { $set: { revoked_at: now, replaced_by: next._id } },
    );
    if (!claimed) {
      await this.handle_unclaimed(token_hash, now);
      throw new UnauthorizedException(INVALID_REFRESH_TOKEN);
    }

    await this.model.create({
      _id: next._id,
      user_id: claimed.user_id,
      token_hash: next.token_hash,
      // Absolute lifetime: rotation never extends the original expiry.
      expires_at: claimed.expires_at,
      revoked_at: null,
      replaced_by: null,
    });
    return { user_id: claimed.user_id.toString(), refresh_token: next.raw };
  }

  /** Reuse detection: a rotated token presented after the grace window. */
  private async handle_unclaimed(token_hash: string, now: Date): Promise<void> {
    const existing = await this.model.findOne({ token_hash });
    if (
      existing?.revoked_at &&
      existing.replaced_by &&
      now.getTime() - existing.revoked_at.getTime() > REUSE_GRACE_MS
    ) {
      await this.model.updateMany(
        { user_id: existing.user_id, revoked_at: null },
        { $set: { revoked_at: now } },
      );
    }
  }

  async revoke(raw: string): Promise<void> {
    await this.model.updateOne(
      { token_hash: hash_token(raw), revoked_at: null },
      { $set: { revoked_at: this.now() } },
    );
  }
}
