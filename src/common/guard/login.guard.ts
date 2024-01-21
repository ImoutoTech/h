import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { BusinessException, BUSINESS_ERROR_CODE } from '../exceptions';
import * as jwt from 'jsonwebtoken';

const parseHeaderToken = (request: any, logger: Logger): string => {
  const authorization = request.headers.authorization || '';

  const bearer = authorization.split(' ');

  if (!bearer || bearer.length < 2) {
    logger.warn(`出现无token请求${request.url}`);
    BusinessException.emptyToken();
  }

  return bearer[1];
};

const handleAuthError = (e: Error, logger: Logger, request: any) => {
  if (e instanceof jwt.TokenExpiredError) {
    logger.warn(`过期token请求${request.url}`);
    BusinessException.throw(BUSINESS_ERROR_CODE.EXPIRED_TOKEN, e.message);
  }

  logger.warn(`错误token请求${request.url}`);
  BusinessException.throw(BUSINESS_ERROR_CODE.INVALID_TOKEN, 'token错误');
};

@Injectable()
export class LoginGuard implements CanActivate {
  @Inject(ConfigService)
  private config: ConfigService;

  private logger = new Logger();

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = parseHeaderToken(request, this.logger);

    try {
      const info = jwt.verify(
        token,
        this.config.get<string>('TOKEN_SECRET', ''),
      ) as jwt.JwtPayload;

      if (info.refresh) {
        this.logger.warn(`用户#${info.id}错误使用refresh token`);
        BusinessException.throw(BUSINESS_ERROR_CODE.INVALID_TOKEN, 'token错误');
      }

      request.user = info;
      return true;
    } catch (e) {
      handleAuthError(e, this.logger, request);
    }
  }
}

@Injectable()
export class RefreshGuard implements CanActivate {
  @Inject(ConfigService)
  private config: ConfigService;

  private logger = new Logger();

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = parseHeaderToken(request, this.logger);

    try {
      const info = jwt.verify(
        token,
        this.config.get<string>('TOKEN_SECRET', ''),
      ) as jwt.JwtPayload;

      if (!info.refresh) {
        this.logger.warn(`用户#${info.id}没有使用refresh token`);
        BusinessException.throw(BUSINESS_ERROR_CODE.INVALID_TOKEN, 'token错误');
      }

      request.user = info;
      return true;
    } catch (e) {
      handleAuthError(e, this.logger, request);
    }
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  @Inject(ConfigService)
  private config: ConfigService;

  private logger = new Logger();

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = parseHeaderToken(request, this.logger);
    const info: Record<string, unknown> = {};

    try {
      Object.assign(
        info,
        jwt.verify(
          token,
          this.config.get<string>('TOKEN_SECRET', ''),
        ) as jwt.JwtPayload,
      );

      if (info.refresh) {
        this.logger.warn(`用户#${info.id}错误使用refresh token`);
        BusinessException.throw(BUSINESS_ERROR_CODE.INVALID_TOKEN, 'token错误');
      }
    } catch (e) {
      handleAuthError(e, this.logger, request);
    }

    if ((info.role as number) !== 0) {
      BusinessException.throwForbidden();
    }

    request.user = info;
    return true;
  }
}
