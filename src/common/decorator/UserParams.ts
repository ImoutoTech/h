import { UserJwtPayload } from '@reus-able/types';
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const UserParams = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserJwtPayload => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
