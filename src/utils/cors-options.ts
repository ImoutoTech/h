import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

export function createCorsOptions(allowedOrigin: string): CorsOptions {
  const origin = new URL(allowedOrigin).origin;
  return {
    origin(requestOrigin, callback) {
      // Requests without Origin are server-to-server and are not CORS requests.
      callback(null, requestOrigin === undefined || requestOrigin === origin);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    optionsSuccessStatus: 204,
  };
}
