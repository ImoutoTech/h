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
      );
      request.user = info;
      return true;
    } catch (e) {
      if (e instanceof jwt.TokenExpiredError) {
        BusinessException.throw(BUSINESS_ERROR_CODE.EXPIRED_TOKEN, e.message);
      }

      BusinessException.throwForbidden();
    }
  }
}
