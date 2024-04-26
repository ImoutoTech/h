import { OauthAuthorizeDto } from '@/dto';
import { SubApp, User } from '@/entity';
import { generateRandomString } from '@/utils';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BusinessException,
  HLOGGER_TOKEN,
  HLogger,
  RedisService,
} from '@reus-able/nestjs';
import { Repository } from 'typeorm';

@Injectable()
export class OAuthService {
  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  @InjectRepository(SubApp)
  private appRepo: Repository<SubApp>;

  @InjectRepository(User)
  private userRepo: Repository<User>;

  @Inject(RedisService)
  private cache: RedisService;

  private log(text: string) {
    this.logger.log(text, OAuthService.name);
  }

  private warn(text: string) {
    this.logger.warn(text, OAuthService.name);
  }

  private getCodeRedisKey(code: string) {
    const CODE_REDIS_PREFIX = 'oauth-code-';

    return `${CODE_REDIS_PREFIX}${code}`;
  }

  async authorize(body: OauthAuthorizeDto, userId: number) {
    const app = await this.appRepo.findOneOrFail({
      where: {
        id: body.client_id,
      },
      relations: {
        meta: true,
      },
    });

    if (!body.redirect_uri.startsWith(app.callback)) {
      this.warn(`用户#${userId}尝试授权子应用${app.id}失败，非法回调地址`);
      throw new BusinessException('非法回调地址');
    }

    const token = generateRandomString(16);
    const redisKey = this.getCodeRedisKey(token);

    app.meta.visitNum += 1;
    this.appRepo.save(app);

    await this.cache.jsonSet(
      redisKey,
      {
        user: userId,
      },
      600,
    );

    this.log(`用户#${userId}尝试授权子应用${app.id}成功`);

    return {
      state: body.state,
      access_token: token,
    };
  }

  async getToken() {}

  async getUser() {}
}
