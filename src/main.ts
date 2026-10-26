import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config_service = app.get(ConfigService);

  app.setGlobalPrefix('api');
  const cors_origins = config_service.get<string[] | null>('CORS_ORIGINS');
  app.enableCors(cors_origins ? { origin: cors_origins } : undefined);
  app.enableShutdownHooks();

  const swagger_config = new DocumentBuilder()
    .setTitle('Study English API')
    .setDescription('API documentation for the Study English application')
    .setVersion('1.0')
    .build();
  const swagger_document = SwaggerModule.createDocument(app, swagger_config);
  SwaggerModule.setup('docs', app, swagger_document);

  const port = config_service.getOrThrow<number>('PORT');
  await app.listen(port, '0.0.0.0');
}
await bootstrap();
