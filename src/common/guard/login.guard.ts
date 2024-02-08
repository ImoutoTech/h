import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { FastifyRequest } from 'fastify';
import { Observable } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import { BUSINESS_ERROR_CODE } from '@reus-able/const';
import * as jwt from 'jsonwebtoken';
import { HLOGGER_TOKEN, HLogger, BusinessException } from '@reus-able/nestjs';
import { Reflector } from '@nestjs/core';
import { UserJwtPayload, UserRole, AuthRoleType } from '@reus-able/types';

const parseHeaderToken = (request: FastifyRequest, logger: HLogger): string => {
  const authorization = request.headers.authorization || '';

  const bearer = authorization.split(' ');

  if (!bearer || bearer.length < 2) {
    logger.warn(`出现无token请求${request.url}`);
    BusinessException.emptyToken();
  }

  return bearer[1];
};

const handleAuthError = (
  e: Error,
  logger: HLogger,
  request: FastifyRequest,
) => {
  if (e instanceof jwt.TokenExpiredError) {
    logger.warn(`过期token请求${request.url}`, 'AuthGuard');
    BusinessException.throw(
      BUSINESS_ERROR_CODE.EXPIRED_TOKEN,
      'token 已经过期',
      HttpStatus.UNAUTHORIZED,
    );
  }

  logger.warn(`错误token请求${request.url}`, 'AuthGuard');
  BusinessException.throw(BUSINESS_ERROR_CODE.INVALID_TOKEN, 'token错误');
};

@Injectable()
export class AuthGuard implements CanActivate {
  @Inject(ConfigService)
  private config: ConfigService;

  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  @Inject(Reflector)
  private reflector: Reflector;

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const roles = this.reflector.get<AuthRoleType[]>(
      'roles',
      context.getHandler(),
    );
    if (!roles || !roles.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const token = parseHeaderToken(request, this.logger);

    try {
      const info = jwt.verify(
        token,
        this.config.get<string>('TOKEN_SECRET', ''),
      ) as UserJwtPayload;

      if (info.refresh && !roles.includes('refresh')) {
        this.logger.warn(`用户#${info.id}错误使用refresh token`);
        BusinessException.throw(BUSINESS_ERROR_CODE.INVALID_TOKEN, 'token错误');
      }

      if (!info.refresh && roles.includes('refresh')) {
        this.logger.warn(`用户#${info.id}没有使用refresh token`);
        BusinessException.throw(BUSINESS_ERROR_CODE.INVALID_TOKEN, 'token错误');
      }

      if (info.role !== UserRole.ADMIN && roles.includes('admin')) {
        this.logger.warn(`用户#${info.id}尝试访问admin权限接口`);
        BusinessException.throwForbidden();
      }

      request.user = info;
      return true;
    } catch (e) {
      handleAuthError(e, this.logger, request);
    }
  }
}
