import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { VersioningType, VERSION_NEUTRAL } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { safeHouseCallbackUrl } from './module/identity/safe-house-callback';
import { resolveListenPort } from './utils/listen-port';
import { createCorsOptions } from './utils/cors-options';

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
  app.enableCors(createCorsOptions(safeHouseBase));

  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter(), new HttpExceptionFilter());

  // Nest registers Fastify's default form parser during initialization. Replace
  // it afterwards so oidc-provider receives the original form-encoded payload.
  await app.init();
  const fastify = app.getHttpAdapter().getInstance();
  fastify.removeContentTypeParser('application/x-www-form-urlencoded');
  fastify.addContentTypeParser(
    'application/x-www-form-urlencoded',
    { parseAs: 'string' },
    (
      _request: unknown,
      body: string,
      done: (error: Error | null, value?: string) => void,
    ) => done(null, body),
  );

  const port = resolveListenPort(config.get<string>('PORT'));
  await app.listen(port, '0.0.0.0');
}
bootstrap();
