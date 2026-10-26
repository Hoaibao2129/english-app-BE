import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { parse_duration_ms } from '../config/env.validation.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RefreshTokenService } from './refresh-token.service.js';
import {
  RefreshToken,
  RefreshTokenSchema,
} from './schemas/refresh-token.schema.js';
import { User, UserSchema } from './schemas/user.schema.js';
import {
  AnswerLog,
  AnswerLogSchema,
} from '../vocabulary/schemas/answer-log.schema.js';
import {
  WordProgress,
  WordProgressSchema,
} from '../vocabulary/schemas/word-progress.schema.js';
import { LegacyProgressService } from './legacy-progress.service.js';
import { TokenService } from './token.service.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: RefreshToken.name, schema: RefreshTokenSchema },
      { name: WordProgress.name, schema: WordProgressSchema },
      { name: AnswerLog.name, schema: AnswerLogSchema },
    ]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          algorithm: 'HS256' as const,
          expiresIn: Math.floor(
            parse_duration_ms(config.get<string>('JWT_ACCESS_TTL') ?? '15m') /
              1000,
          ),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    UsersService,
    LegacyProgressService,
    RefreshTokenService,
    TokenService,
    AuthService,
    JwtAuthGuard,
  ],
  exports: [JwtAuthGuard, TokenService],
})
export class AuthModule {}
