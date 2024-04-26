import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { OAuthService } from './oauth.service';
import { OauthAuthorizeDto } from '@/dto';
import { AuthRoles, UserParams } from '@reus-able/nestjs';
import { UserJwtPayload } from '@reus-able/types';

@Controller('oauth')
export class OAuthController {
  constructor(private readonly service: OAuthService) {}

  @Post('authorize')
  @AuthRoles('user')
  @HttpCode(HttpStatus.OK)
  authorize(
    @Body() body: OauthAuthorizeDto,
    @UserParams() user: UserJwtPayload,
  ) {
    return this.service.authorize(body, user.id);
  }

  @Post('token')
  @AuthRoles('user')
  getToken() {
    return this.service.getToken();
  }

  @Get('user')
  getUser() {
    return this.service.getUser();
  }
}
