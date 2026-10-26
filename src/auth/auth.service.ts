import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { LegacyProgressService } from './legacy-progress.service.js';
import { RefreshTokenService } from './refresh-token.service.js';
import { TokenService } from './token.service.js';
import { UsersService } from './users.service.js';
import type {
  AuthResult,
  LoginInput,
  PublicUser,
  RegisterInput,
  TokenPair,
} from './auth.types.js';
import type { UserDocument } from './schemas/user.schema.js';

const BCRYPT_COST = 10;
const INVALID_CREDENTIALS = 'Invalid email or password';
// Compared against when the email is unknown so timing does not reveal it.
const DUMMY_HASH = bcrypt.hashSync('dummy-password', BCRYPT_COST);

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly tokens: TokenService,
    private readonly refresh_tokens: RefreshTokenService,
    private readonly legacy: LegacyProgressService,
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
