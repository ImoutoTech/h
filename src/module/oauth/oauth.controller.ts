import { Controller, Get, Post } from '@nestjs/common';
import { OAuthService } from './oauth.service';

@Controller('oauth')
export class OAuthController {
  constructor(private readonly service: OAuthService) {}

  @Get('authorize')
  authorize() {
    return this.service.authorize();
  }

  @Post('token')
  getToken() {
    return this.service.getToken();
  }

  @Get('user')
  getUser() {
    return this.service.getUser();
  }
}
