import { HttpException, HttpStatus } from '@nestjs/common';
import { BUSINESS_ERROR_CODE } from './constants';

type BusinessError = {
  code: number;
  message: string;
  httpCode?: HttpStatus;
};

export class BusinessException extends HttpException {
  constructor(err: BusinessError | string) {
    if (typeof err === 'string') {
      err = {
        code: BUSINESS_ERROR_CODE.COMMON,
        message: err,
      };
    }
    super(err, HttpStatus.OK);
  }

  static throwForbidden() {
    throw new BusinessException({
      code: BUSINESS_ERROR_CODE.ACCESS_FORBIDDEN,
      message: '抱歉哦，您无此权限！',
    });
  }

  static emptyToken() {
    throw new BusinessException({
      code: BUSINESS_ERROR_CODE.EMPTY_TOKEN,
      message: 'token缺失',
    });
  }

  static throw(
    code: BUSINESS_ERROR_CODE,
    message: string,
    httpCode = HttpStatus.INTERNAL_SERVER_ERROR,
  ) {
    throw new BusinessException({
      code,
      message,
      httpCode,
    });
  }
}
