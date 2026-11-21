import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import {
  ForgotPasswordDtoSchema,
  LoginDtoSchema,
  RefreshTokenDtoSchema,
  RegisterDtoSchema,
  ResetPasswordDtoSchema,
  VerifyOtpDtoSchema,
} from './auth.dto.js';
import type {
  ForgotPasswordDto,
  LoginDto,
  RefreshTokenDto,
  RegisterDto,
  ResetPasswordDto,
  VerifyOtpDto,
} from './auth.dto.js';
import { AuthService } from './auth.service.js';
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
  register(
    @Body(new ZodValidationPipe(RegisterDtoSchema)) dto: RegisterDto,
  ): Promise<AuthResult> {
    return this.auth.register(dto);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Log in with email and password' })
  login(
    @Body(new ZodValidationPipe(LoginDtoSchema)) dto: LoginDto,
  ): Promise<AuthResult> {
    return this.auth.login(dto);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Rotate a refresh token for a new token pair' })
  refresh(
    @Body(new ZodValidationPipe(RefreshTokenDtoSchema)) dto: RefreshTokenDto,
  ): Promise<TokenPair> {
    return this.auth.refresh(dto.refresh_token);
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke a refresh token' })
  logout(
    @Body(new ZodValidationPipe(RefreshTokenDtoSchema)) dto: RefreshTokenDto,
  ): Promise<void> {
    return this.auth.logout(dto.refresh_token);
  }

  @Post('forgot-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Send a password reset OTP to a registered email' })
  forgotPassword(
    @Body(new ZodValidationPipe(ForgotPasswordDtoSchema)) dto: ForgotPasswordDto,
  ): Promise<OtpSentResult> {
    return this.auth.requestPasswordOtp(dto);
  }

  @Post('forgot-password/verify')
  @HttpCode(200)
  @ApiOperation({ summary: 'Verify a password reset OTP for a reset token' })
  verifyForgotPassword(
    @Body(new ZodValidationPipe(VerifyOtpDtoSchema)) dto: VerifyOtpDto,
  ): Promise<ResetTokenResult> {
    return this.auth.verifyPasswordOtp(dto);
  }

  @Post('reset-password')
  @HttpCode(200)
  @ApiOperation({ summary: 'Set a new password using a reset token' })
  resetPassword(
    @Body(new ZodValidationPipe(ResetPasswordDtoSchema)) dto: ResetPasswordDto,
  ): Promise<MessageResult> {
    return this.auth.resetPassword(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current user' })
  me(@CurrentUser() user: AuthUser): Promise<PublicUser> {
    return this.auth.getMe(user.user_id);
  }
}
