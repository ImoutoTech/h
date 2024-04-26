import { OauthAuthorizeDto } from '@/dto';
import { SubApp, User, UserExportData } from '@/entity';
import { generateRandomString } from '@/utils';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  BusinessException,
  HLOGGER_TOKEN,
  HLogger,
  RedisService,
} from '@reus-able/nestjs';
import { isNil } from 'lodash';
import { Repository } from 'typeorm';

interface RedisCodeData {
  user: number;
}

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

  private getTokenRedisKey(code: string) {
    const CODE_REDIS_PREFIX = 'oauth-token-';

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

  async getToken(id: string, secret: string, code: string, url: string) {
    const redisKey = this.getCodeRedisKey(code);
    const codeData = await this.cache.jsonGet<RedisCodeData>(redisKey);

    if (isNil(codeData)) {
      this.warn(`子应用${id}获取token失败，非法code`);
      throw new BusinessException('code错误或已经过期');
    }

    const app = await this.appRepo.findOneOrFail({
      where: {
        id,
      },
      relations: {
        secrets: true,
      },
    });

    if (!url.startsWith(app.callback)) {
      this.warn(`子应用${app.id}获取token失败，非法回调地址`);
      throw new BusinessException('非法回调地址');
    }

    if (!app.secrets.map((s) => s.value).includes(secret)) {
      this.warn(`子应用${app.id}获取token失败，非法秘钥`);
      throw new BusinessException('非法秘钥');
    }

    const token = generateRandomString(16);
    const tokenKey = this.getTokenRedisKey(token);

    await this.cache.jsonSet(
      tokenKey,
      {
        user: codeData.user,
      },
      600,
    );
    await this.cache.del(redisKey);

    this.warn(`子应用${app.id}获取token成功`);

    return {
      access_token: token,
      scope: 'user',
      token_type: 'Bearer',
    };
  }

  async getUser(token: string) {
    if (!token || !token.startsWith('Bearer ')) {
      throw new BusinessException('非法秘钥');
    }

    const key = token.split(' ')?.[1];
    const redisData = await this.cache.jsonGet<RedisCodeData>(
      this.getTokenRedisKey(key),
    );

    if (isNil(redisData)) {
      throw new BusinessException('非法秘钥');
    }

    await this.cache.del(this.getTokenRedisKey(key));

    const cached = await this.cache.jsonGet<UserExportData>(
      `user-${redisData.user}`,
    );
    if (cached) {
      return cached;
    }

    const user = await this.userRepo.findOneByOrFail({ id: redisData.user });

    return user.getData();
  }
}
