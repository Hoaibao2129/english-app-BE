import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MailModule } from '../mail/mail.module.js';
import { VocabularyModule } from '../vocabulary/vocabulary.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthTokenModule } from './auth-token.module.js';
import { User, UserSchema } from './schemas/user.schema.js';
import { UsersService } from './users.service.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    AuthTokenModule,
    MailModule,
    VocabularyModule,
  ],
  controllers: [AuthController],
  providers: [UsersService, AuthService],
  exports: [AuthTokenModule],
})
export class AuthModule {}
