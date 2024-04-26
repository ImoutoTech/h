import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import { OAuthService } from './oauth.service';
import { OauthAuthorizeDto } from '@/dto';
import { AuthRoles, UserParams, RequiredPipe } from '@reus-able/nestjs';
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
  @HttpCode(HttpStatus.OK)
  getToken(
    @Query('client_id', RequiredPipe) id: string,
    @Query('client_secret', RequiredPipe) secret: string,
    @Query('code', RequiredPipe) code: string,
    @Query('redirect_uri', RequiredPipe) url: string,
  ) {
    return this.service.getToken(id, secret, code, url);
  }

  @Get('user')
  getUser() {
    return this.service.getUser();
  }
}
