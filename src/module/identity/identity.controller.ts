import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthRoles, PermissionGuard, UserParams } from '@reus-able/nestjs';
import { BusinessException } from '@reus-able/nestjs';
import type { UserJwtPayload } from '@reus-able/types';
import type { ExternalProvider } from '@/entity';
import { ExternalCallbackDto, UpdateProviderConfigDto } from '@/dto';
import { ExternalIdentityService } from './external-identity.service';
import { ProviderConfigService } from './provider-config.service';
import { safeHouseCallbackUrl } from './safe-house-callback';

@Controller('external')
export class IdentityController {
  constructor(
    private readonly identities: ExternalIdentityService,
    private readonly configs: ProviderConfigService,
    private readonly config: ConfigService,
  ) {}

  @Get('providers')
  @AuthRoles()
  providers() {
    return this.configs.list(true);
  }

  @Get('result/:id')
  @AuthRoles()
  result(@Param('id') id: string) {
    return this.identities.exchangeResult(id);
  }

  private provider(value: string): ExternalProvider {
    if (value !== 'github' && value !== 'google') {
      throw new BusinessException('不支持的外部登录提供方');
    }
    return value;
  }

  @Get(':provider/start')
  @AuthRoles()
  start(
    @Param('provider') provider: ExternalProvider,
    @Query('return_to') returnTo?: string,
  ) {
    return this.identities.start(this.provider(provider), returnTo);
  }

  @Get(':provider/callback')
  @AuthRoles()
  callback(
    @Param('provider') provider: ExternalProvider,
    @Query() query: ExternalCallbackDto,
    @Res() response: any,
  ) {
    return this.completeCallback(this.provider(provider), query, response);
  }

  private async completeCallback(
    provider: ExternalProvider,
    query: ExternalCallbackDto,
    response: any,
  ) {
    let result: Record<string, any>;
    try {
      result = await this.identities.callback(
        provider,
        query.code,
        query.state,
        query.error,
      );
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : '';
      result = {
        outcome: message.includes('状态无效')
          ? 'state_invalid_or_expired'
          : message.includes('未启用')
            ? 'provider_disabled'
            : message.includes('配置')
              ? 'provider_misconfigured'
              : 'provider_error',
      };
    }
    const resultId = await this.identities.storeResult(result);
    const destination = safeHouseCallbackUrl(
      this.config.get<string>('SAFE_HOUSE_PUBLIC_URL'),
      resultId,
    );
    return response.redirect(302, destination);
  }

  @Get('identities/:provider/start')
  @AuthRoles('user')
  startBinding(
    @Param('provider') provider: ExternalProvider,
    @UserParams() user: UserJwtPayload,
    @Query('return_to') returnTo?: string,
  ) {
    return this.identities.start(this.provider(provider), returnTo, user.id);
  }

  @Get('identities/me')
  @AuthRoles('user')
  list(@UserParams() user: UserJwtPayload) {
    return this.identities.list(user.id);
  }

  @Post('identities/bind')
  @AuthRoles('user')
  bind(
    @UserParams() user: UserJwtPayload,
    @Body('bindingToken') token: string,
  ) {
    return this.identities.bind(user.id, token);
  }

  @Delete('identities/:id')
  @AuthRoles('user')
  unbind(
    @UserParams() user: UserJwtPayload,
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.identities.unbind(user.id, id);
  }

  @Get('admin/providers')
  @PermissionGuard('oauth-provider-admin')
  adminProviders() {
    return this.configs.list();
  }

  @Post('admin/providers/:provider')
  @PermissionGuard('oauth-provider-admin')
  updateProvider(
    @Param('provider') provider: ExternalProvider,
    @Body() body: UpdateProviderConfigDto,
    @UserParams() user: UserJwtPayload,
  ) {
    return this.configs.update(this.provider(provider), body, user.id);
  }
}
