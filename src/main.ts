import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { VersioningType, VERSION_NEUTRAL } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { safeHouseCallbackUrl } from './module/identity/safe-house-callback';

import {
  TransformInterceptor,
  AllExceptionsFilter,
  HttpExceptionFilter,
} from '@reus-able/nestjs';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  app.enableVersioning({
    defaultVersion: [VERSION_NEUTRAL, '1'],
    type: VersioningType.URI,
  });

  const config = app.get(ConfigService);
  const safeHouseBase = config.getOrThrow<string>('SAFE_HOUSE_PUBLIC_URL');
  safeHouseCallbackUrl(safeHouseBase, 'startup-validation');
  const safeHouseUrl = new URL(safeHouseBase);
  app.enableCors({
    origin: safeHouseUrl.origin,
    credentials: true,
  });

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

  await app.listen(4000, '0.0.0.0');
}
bootstrap();
