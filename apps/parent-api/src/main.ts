import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(helmet());
  app.use(compression());

  const clientUrl = configService.get('clientUrl') || 'http://localhost:3000';
  const apiPort = configService.get('port') || 3002;
  const apiOrigin = `http://localhost:${apiPort}`;
  const allowedOrigins = [clientUrl, apiOrigin];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      return callback(null, allowedOrigins.includes(origin));
    },
    credentials: true,
  });

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SVBK Parent Portal API')
    .setDescription(
      `**Sri Venkateswara Bala Kuteer – Parent Portal**\n\n` +
        `OTP-based authentication for parents to view children fee records and make payments.\n\n` +
        `**Demo Mode**: Set \`DEMO_MODE=true\` in .env – any 6-digit code is accepted as a valid OTP.\n\n` +
        `**Auth flow**: \`POST /api/auth/send-otp\` → \`POST /api/auth/verify-otp\` → use \`accessToken\` as Bearer`,
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  const port = configService.get('port') || 3002;
  await app.listen(port);

  console.log('\n─────────────────────────────────────────────────');
  console.log(`  SVBK Parent Portal API  →  http://localhost:${port}/api`);
  console.log(`  Swagger Docs            →  http://localhost:${port}/api/docs`);
  console.log(
    `  Demo Mode               →  ${configService.get('demoMode') ? 'ON (any 6-digit OTP accepted)' : 'OFF'}`,
  );
  console.log('─────────────────────────────────────────────────\n');
}
bootstrap();
