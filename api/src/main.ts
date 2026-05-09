import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const configService = app.get(ConfigService);

  // Security & performance middleware
  app.use(helmet());
  app.use(compression());

  // Global prefix
  app.setGlobalPrefix('api');

  // CORS — comma-separated list in CORS_ORIGINS, or "*" to allow all (dev only)
  const corsOriginsRaw =
    configService.get<string>('CORS_ORIGINS') ?? process.env.CORS_ORIGINS ?? '';
  const corsOrigins = corsOriginsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({
    origin: corsOrigins.includes('*') || corsOrigins.length === 0
      ? true
      : corsOrigins,
    credentials: true,
  });

  // Global pipes, interceptors, filters
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle('SVBK School Fee Management API')
    .setDescription('Multi-tenant School Fee Management System')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('PORT') || 3001;
  await app.listen(port);
  console.log(`SVBK API running on: http://localhost:${port}/api`);
  console.log(`Swagger docs at:      http://localhost:${port}/api/docs`);
}
bootstrap();
