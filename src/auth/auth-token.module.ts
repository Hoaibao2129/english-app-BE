import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { parse_duration_ms } from '../config/env.validation.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { RefreshTokenService } from './refresh-token.service.js';
import {
  RefreshToken,
  RefreshTokenSchema,
} from './schemas/refresh-token.schema.js';
import { TokenService } from './token.service.js';

/**
 * Token signing/verification and the JWT guard, split from AuthModule so
 * feature modules can use the guard without importing AuthModule.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: RefreshToken.name, schema: RefreshTokenSchema },
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
  providers: [RefreshTokenService, TokenService, JwtAuthGuard],
  exports: [RefreshTokenService, TokenService, JwtAuthGuard],
})
export class AuthTokenModule {}
