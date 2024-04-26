import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyRequest, FastifyReply } from 'fastify';

@Injectable()
export class FastifyCorsMiddleware implements NestMiddleware {
  constructor(private configService: ConfigService) {}

  use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void) {
    const allowedOrigins = this.configService
      .get<string>('ALLOWED_ORIGIN', '')
      .split(',');
    const allowedMethod = this.configService.get<string>(
      'ALLOWED_METHOD',
      'GET, POST, PUT, DELETE, PATCH',
    );
    const requestOrigin = req.headers.origin;

    if (allowedOrigins.includes(requestOrigin)) {
      res.setHeader('Access-Control-Allow-Origin', requestOrigin);
      res.setHeader('Access-Control-Allow-Methods', allowedMethod);
      res.setHeader('Access-Control-Allow-Headers', '*');

      if (req.method === 'OPTIONS') {
        res.statusCode = 204;
        res.end();
        return;
      }

      next();
    } else {
      res.statusCode = 401;
      res.end();
    }
  }
}
