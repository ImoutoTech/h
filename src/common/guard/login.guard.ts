import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { BusinessException, BUSINESS_ERROR_CODE } from '../exceptions';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class LoginGuard implements CanActivate {
  @Inject(ConfigService)
  private config: ConfigService;

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();

    const authorization = request.headers.authorization || '';

    const bearer = authorization.split(' ');

    if (!bearer || bearer.length < 2) {
      BusinessException.emptyToken();
    }

    const token = bearer[1];

    try {
      const info = jwt.verify(
        token,
        this.config.get<string>('TOKEN_SECRET', ''),
      ) as jwt.JwtPayload;

      if (info.refresh) {
        BusinessException.throw(BUSINESS_ERROR_CODE.INVALID_TOKEN, 'token错误');
      }

      request.user = info;
      return true;
    } catch (e) {
      if (e instanceof jwt.TokenExpiredError) {
        BusinessException.throw(BUSINESS_ERROR_CODE.EXPIRED_TOKEN, e.message);
      }

      BusinessException.throw(BUSINESS_ERROR_CODE.INVALID_TOKEN, 'token错误');
    }
  }
}

@Injectable()
export class RefreshGuard implements CanActivate {
  @Inject(ConfigService)
  private config: ConfigService;

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();

    const authorization = request.headers.authorization || '';

    const bearer = authorization.split(' ');

    if (!bearer || bearer.length < 2) {
      BusinessException.emptyToken();
    }

    const token = bearer[1];

    try {
      const info = jwt.verify(
        token,
        this.config.get<string>('TOKEN_SECRET', ''),
      ) as jwt.JwtPayload;

      if (!info.refresh) {
        BusinessException.throw(BUSINESS_ERROR_CODE.INVALID_TOKEN, 'token错误');
      }

      request.user = info;
      return true;
    } catch (e) {
      if (e instanceof jwt.TokenExpiredError) {
        BusinessException.throw(BUSINESS_ERROR_CODE.EXPIRED_TOKEN, e.message);
      }

      BusinessException.throw(BUSINESS_ERROR_CODE.INVALID_TOKEN, 'token错误');
    }
  }
}

@Injectable()
export class AdminGuard implements CanActivate {
  @Inject(ConfigService)
  private config: ConfigService;

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();

    const authorization = request.headers.authorization || '';

    const bearer = authorization.split(' ');

    if (!bearer || bearer.length < 2) {
      BusinessException.emptyToken();
    }

    const token = bearer[1];
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
        BusinessException.throw(BUSINESS_ERROR_CODE.INVALID_TOKEN, 'token错误');
      }
    } catch (e) {
      if (e instanceof jwt.TokenExpiredError) {
        BusinessException.throw(BUSINESS_ERROR_CODE.EXPIRED_TOKEN, e.message);
      }

      BusinessException.throw(BUSINESS_ERROR_CODE.INVALID_TOKEN, 'token错误');
    }

    if ((info.role as number) !== 0) {
      BusinessException.throwForbidden;
    }

    request.user = info;
    return true;
  }
}
