import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { validate_environment } from './config/env.validation.js';
import { AuthModule } from './auth/auth.module.js';
import { VocabularyModule } from './vocabulary/vocabulary.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validate_environment,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config_service: ConfigService) => ({
        uri: config_service.getOrThrow<string>('MONGODB_URI'),
      }),
    }),
    AuthModule,
    VocabularyModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
