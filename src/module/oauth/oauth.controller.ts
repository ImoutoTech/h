import {
  All,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { AuthRoles, UserParams } from '@reus-able/nestjs';
import type { UserJwtPayload } from '@reus-able/types';
import { OAuthService } from './oauth.service';

@Controller('oauth/interaction')
export class OAuthController {
  constructor(private readonly service: OAuthService) {}

  @Get(':uid')
  @AuthRoles('user')
  get(
    @Param('uid') uid: string,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    return this.service.interaction(uid, req.raw, res.raw);
  }

  @Post(':uid')
  @AuthRoles('user')
  finish(
    @Param('uid') uid: string,
    @Body('approved') approved: boolean,
    @UserParams() user: UserJwtPayload,
    @Req() req: any,
    @Res({ passthrough: true }) res: any,
  ) {
    return this.service
      .finish(uid, approved === true, user.id, req.raw, res.raw)
      .then(({ continuationUrl, cookies }) => {
        if (cookies.length) res.header('set-cookie', cookies);
        return { continuationUrl };
      });
  }
}

@Controller()
export class OidcProtocolController {
  constructor(private readonly service: OAuthService) {}

  @Get('oidc/jwks')
  async jwks(@Res() res: any) {
    await this.service.initialize();
    return res.type('application/json').send(this.service.jwks());
  }

  @Get('oidc/.well-known/openid-configuration')
  async issuerDiscovery(@Res() res: any) {
    return res.type('application/json').send(await this.service.discovery());
  }

  @All('oidc/*')
  async protocol(@Req() req: any, @Res() res: any) {
    const provider = await this.service.initialize();
    res.hijack();
    // oidc-provider's callback expects the path relative to its mount point.
    // Nest controllers do not strip their route prefix like koa-mount does.
    const originalUrl = req.raw.url;
    req.raw.url = originalUrl.replace(/^\/oidc(?=\/|$)/, '') || '/';
    try {
      return await provider.callback()(req.raw, res.raw);
    } finally {
      req.raw.url = originalUrl;
    }
  }

  @Get('.well-known/openid-configuration')
  async discovery(@Res() res: any) {
    return res.type('application/json').send(await this.service.discovery());
  }
}
