import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcryptjs';
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import { MailService } from '../mail/mail.service.js';
import { LegacyProgressService } from '../vocabulary/progress/legacy-progress.service.js';
import {
  MAX_OTP_ATTEMPTS,
  OTP_LENGTH,
  OTP_TTL_MS,
  RESET_TOKEN_TTL_MS,
} from './auth.constants.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { TokenService } from './token.service.js';
import { UsersService } from './users.service.js';
import type {
  AuthResult,
  ForgotPasswordInput,
  LoginInput,
  MessageResult,
  OtpSentResult,
  PublicUser,
  RegisterInput,
  ResetPasswordInput,
  ResetTokenResult,
  TokenPair,
  VerifyOtpInput,
} from './auth.types.js';
import type { UserDocument } from './schemas/user.schema.js';

const BCRYPT_COST = 10;
const INVALID_CREDENTIALS = 'Invalid email or password';
// Compared against when the email is unknown so timing does not reveal it.
const DUMMY_HASH = bcrypt.hashSync('dummy-password', BCRYPT_COST);
const EMAIL_NOT_REGISTERED = 'Email is not registered';
const INVALID_OTP = 'OTP is invalid or expired';
const INVALID_RESET_TOKEN = 'Reset token is invalid or expired';

function hash_reset_token(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

@Injectable()
export class AuthService {
  /** Injectable clock so tests can move time without sleeping. */
  now: () => Date = () => new Date();

  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly refresh_tokens: RefreshTokenService,
    private readonly legacy: LegacyProgressService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async register(input: RegisterInput): Promise<AuthResult> {
    const email = input.email.trim().toLowerCase();
    if (await this.users.find_by_email(email)) {
      throw new ConflictException('Email is already registered');
    }
    const password_hash = await bcrypt.hash(input.password, BCRYPT_COST);
    let user: UserDocument;
    try {
      user = await this.users.create_user({
        email,
        password_hash,
        display_name: input.display_name ?? null,
      });
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
    // The first account inherits pre-auth progress. Errors propagate (500)
    // rather than being swallowed, so a failed claim is never silent.
    if ((await this.users.count_users()) === 1) {
      await this.legacy.claim_legacy_progress(user._id.toHexString());
    }
    return this.build_result(user);
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.users.find_by_email(input.email);
    const matches = await bcrypt.compare(
      input.password,
      user?.password_hash ?? DUMMY_HASH,
    );
    if (!user || !matches) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    // Retry the idempotent claim for the sole account, in case it failed
    // during registration.
    if ((await this.users.count_users()) === 1) {
      await this.legacy.claim_legacy_progress(user._id.toHexString());
    }
    return this.build_result(user);
  }

  async get_me(user_id: string): Promise<PublicUser> {
    const user = await this.users.find_by_id(user_id);
    if (!user) {
      throw new UnauthorizedException('User no longer exists');
    }
    return this.users.to_public(user);
  }

  async refresh(raw: string): Promise<TokenPair> {
    const rotated = await this.refresh_tokens.rotate(raw);
    const user = await this.users.find_by_id(rotated.user_id);
    if (!user) {
      await this.refresh_tokens.revoke(rotated.refresh_token);
      throw new UnauthorizedException('Invalid refresh token');
    }
    const access_token = await this.tokens.sign_access_token({
      user_id: rotated.user_id,
      email: user.email,
      role: user.role,
    });
    return { access_token, refresh_token: rotated.refresh_token };
  }

  logout(raw: string): Promise<void> {
    return this.refresh_tokens.revoke(raw);
  }

  async request_password_otp(
    input: ForgotPasswordInput,
  ): Promise<OtpSentResult> {
    const user = await this.users.find_by_email(input.email);
    if (!user) {
      throw new NotFoundException(EMAIL_NOT_REGISTERED);
    }
    const user_id = user._id.toHexString();
    const otp = String(randomInt(0, 10 ** OTP_LENGTH)).padStart(
      OTP_LENGTH,
      '0',
    );
    await this.users.save_password_reset(
      user_id,
      this.hash_otp(user_id, otp),
      new Date(this.now().getTime() + OTP_TTL_MS),
    );
    try {
      await this.mail.send_otp_email(user.email, otp, OTP_TTL_MS / 60_000);
    } catch {
      await this.users.clear_password_reset(user_id);
      throw new ServiceUnavailableException('Unable to send OTP email');
    }
    return { message: 'OTP sent', expires_in_seconds: OTP_TTL_MS / 1000 };
  }

  async verify_password_otp(input: VerifyOtpInput): Promise<ResetTokenResult> {
    const user = await this.users.find_by_email(input.email);
    if (!user) {
      throw new NotFoundException(EMAIL_NOT_REGISTERED);
    }
    const user_id = user._id.toHexString();
    const now = this.now();
    const state = user.password_reset;
    if (
      !state?.otp_hash ||
      !state.otp_expires_at ||
      state.otp_expires_at.getTime() <= now.getTime() ||
      state.attempts >= MAX_OTP_ATTEMPTS
    ) {
      throw new BadRequestException(INVALID_OTP);
    }
    const expected = this.hash_otp(user_id, input.otp);
    const matches =
      expected.length === state.otp_hash.length &&
      timingSafeEqual(Buffer.from(expected), Buffer.from(state.otp_hash));
    if (!matches) {
      await this.users.record_failed_otp(user_id, MAX_OTP_ATTEMPTS);
      throw new BadRequestException(INVALID_OTP);
    }
    const reset_token = randomBytes(32).toString('base64url');
    const consumed = await this.users.consume_otp(
      user_id,
      state.otp_hash,
      MAX_OTP_ATTEMPTS,
      now,
      hash_reset_token(reset_token),
      new Date(now.getTime() + RESET_TOKEN_TTL_MS),
    );
    if (!consumed) {
      throw new BadRequestException(INVALID_OTP);
    }
    return {
      reset_token,
      expires_in_seconds: RESET_TOKEN_TTL_MS / 1000,
    };
  }

  async reset_password(input: ResetPasswordInput): Promise<MessageResult> {
    const now = this.now();
    const token_hash = hash_reset_token(input.reset_token);
    const user = await this.users.find_by_reset_token_hash(token_hash, now);
    if (!user) {
      throw new UnauthorizedException(INVALID_RESET_TOKEN);
    }
    if (input.new_password !== input.confirm_password) {
      // Hand out a fresh token so the user can retry without a new OTP.
      const next_token = randomBytes(32).toString('base64url');
      const rotated = await this.users.rotate_reset_token(
        token_hash,
        hash_reset_token(next_token),
        new Date(now.getTime() + RESET_TOKEN_TTL_MS),
        now,
      );
      if (!rotated) {
        throw new UnauthorizedException(INVALID_RESET_TOKEN);
      }
      throw new BadRequestException({
        statusCode: 400,
        message: 'confirm_password must match new_password',
        error: 'Bad Request',
        reset_token: next_token,
        expires_in_seconds: RESET_TOKEN_TTL_MS / 1000,
      });
    }
    const password_hash = await bcrypt.hash(input.new_password, BCRYPT_COST);
    const user_id = await this.users.consume_reset_token(
      token_hash,
      now,
      password_hash,
    );
    if (!user_id) {
      throw new UnauthorizedException(INVALID_RESET_TOKEN);
    }
    await this.refresh_tokens.revoke_all_for_user(user_id);
    return { message: 'Password reset successfully' };
  }

  /** Keyed hash so a leaked DB cannot be brute-forced from the 6-digit space. */
  private hash_otp(user_id: string, otp: string): string {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_SECRET'))
      .update(`${user_id}:${otp}`)
      .digest('hex');
  }

  private async build_result(user: UserDocument): Promise<AuthResult> {
    const public_user = this.users.to_public(user);
    const tokens = await this.tokens.issue_tokens({
      user_id: public_user.id,
      email: public_user.email,
      role: public_user.role,
    });
    return { ...tokens, user: public_user };
  }
}
