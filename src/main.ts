import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { VersioningType, VERSION_NEUTRAL } from '@nestjs/common';
import { AppModule } from './app.module';

import { TransformInterceptor } from './common/interceptors';
import { AllExceptionsFilter, HttpExceptionFilter } from './common/exceptions';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  app.enableVersioning({
    defaultVersion: [VERSION_NEUTRAL, '1'],
    type: VersioningType.URI,
  });

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

  await app.listen(4000);
}
bootstrap();
