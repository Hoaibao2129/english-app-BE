import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import {
  parse_forgot_password,
  parse_login,
  parse_refresh_token,
  parse_register,
  parse_reset_password,
  parse_verify_otp,
} from './auth-input.parse.js';
import { CurrentUser } from './current-user.decorator.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import type {
  AuthResult,
  AuthUser,
  MessageResult,
  OtpSentResult,
  PublicUser,
  ResetTokenResult,
  TokenPair,
} from './auth.types.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Create an account and return tokens' })
  register(@Body() body: unknown): Promise<AuthResult> {
    return this.auth.register(parse_register(body));
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log in with email and password' })
  login(@Body() body: unknown): Promise<AuthResult> {
    return this.auth.login(parse_login(body));
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate a refresh token for a new token pair' })
  refresh(@Body() body: unknown): Promise<TokenPair> {
    return this.auth.refresh(parse_refresh_token(body));
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke a refresh token' })
  logout(@Body() body: unknown): Promise<void> {
    return this.auth.logout(parse_refresh_token(body));
  }

  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send a password reset OTP to a registered email' })
  forgot_password(@Body() body: unknown): Promise<OtpSentResult> {
    return this.auth.request_password_otp(parse_forgot_password(body));
  }

  @Post('forgot-password/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify a password reset OTP for a reset token' })
  verify_forgot_password(@Body() body: unknown): Promise<ResetTokenResult> {
    return this.auth.verify_password_otp(parse_verify_otp(body));
  }

  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Set a new password using a reset token' })
  reset_password(@Body() body: unknown): Promise<MessageResult> {
    return this.auth.reset_password(parse_reset_password(body));
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current user' })
  me(@CurrentUser() user: AuthUser): Promise<PublicUser> {
    return this.auth.get_me(user.user_id);
  }
}
