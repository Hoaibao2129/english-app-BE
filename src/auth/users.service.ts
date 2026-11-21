import { Injectable } from '@nestjs/common';
import { UserDocument } from './schemas/user.schema.js';
import type { PublicUser } from './auth.types.js';
import { UsersRepository } from './repositories/users.repository.js';

@Injectable()
export class UsersService {
  constructor(private readonly users_repo: UsersRepository) {}

  createUser(input: {
    email: string;
    password_hash: string;
    display_name: string | null;
  }): Promise<UserDocument> {
    return this.users_repo.createUser(input);
  }

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.users_repo.findByEmail(email);
  }

  findById(id: string): Promise<UserDocument | null> {
    return this.users_repo.findByIdString(id);
  }

  /** Replaces any previous forgot-password state with a fresh OTP. */
  savePasswordReset(
    user_id: string,
    otp_hash: string,
    otp_expires_at: Date,
  ): Promise<void> {
    return this.users_repo.savePasswordReset(
      user_id,
      otp_hash,
      otp_expires_at,
    );
  }

  clearPasswordReset(user_id: string): Promise<void> {
    return this.users_repo.clearPasswordReset(user_id);
  }

  /** Counts a wrong OTP; clears the state once max_attempts is reached. */
  recordFailedOtp(user_id: string, max_attempts: number): Promise<void> {
    return this.users_repo.recordFailedOtp(user_id, max_attempts);
  }

  /** Atomically swaps a live OTP for a reset token. Returns false if lost. */
  consumeOtp(
    user_id: string,
    otp_hash: string,
    max_attempts: number,
    now: Date,
    reset_token_hash: string,
    reset_token_expires_at: Date,
  ): Promise<boolean> {
    return this.users_repo.consumeOtp(
      user_id,
      otp_hash,
      max_attempts,
      now,
      reset_token_hash,
      reset_token_expires_at,
    );
  }

  findByResetTokenHash(
    reset_token_hash: string,
    now: Date,
  ): Promise<UserDocument | null> {
    return this.users_repo.findByResetTokenHash(reset_token_hash, now);
  }

  /** Atomically replaces a live reset token. Returns false if lost. */
  rotateResetToken(
    old_hash: string,
    new_hash: string,
    new_expires_at: Date,
    now: Date,
  ): Promise<boolean> {
    return this.users_repo.rotateResetToken(
      old_hash,
      new_hash,
      new_expires_at,
      now,
    );
  }

  /**
   * Atomically consumes a live reset token and sets the new password hash.
   * Returns the user id, or null if the token was no longer valid.
   */
  consumeResetToken(
    reset_token_hash: string,
    now: Date,
    password_hash: string,
  ): Promise<string | null> {
    return this.users_repo.consumeResetToken(
      reset_token_hash,
      now,
      password_hash,
    );
  }

  countUsers(): Promise<number> {
    return this.users_repo.countDocuments();
  }

  toPublic(user: UserDocument): PublicUser {
    return {
      id: user._id.toHexString(),
      email: user.email,
      display_name: user.display_name ?? null,
      role: user.role,
    };
  }
}
