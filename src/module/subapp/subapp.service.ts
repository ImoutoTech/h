import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, type Repository } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { CreateSubAppDto, UpdateSubAppDto } from '@/dto';
import {
  User,
  SubAppMeta,
  SubApp,
  type SubAppExportData,
  SubAppSecret,
} from '@/entity';
import { ConfigService } from '@nestjs/config';
import { paginate } from 'nestjs-typeorm-paginate';
import { BusinessException } from '@reus-able/nestjs';
import { isNil } from 'lodash';
import { HLOGGER_TOKEN, HLogger, RedisService } from '@reus-able/nestjs';
import { generateRandomString } from '@/utils';

@Injectable()
export class SubAppService {
  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  @InjectRepository(SubApp)
  private appRepo: Repository<SubApp>;

  @InjectRepository(SubAppMeta)
  private metaRepo: Repository<SubAppMeta>;

  @InjectRepository(SubAppSecret)
  private scRepo: Repository<SubAppSecret>;

  @InjectRepository(User)
  private userRepo: Repository<User>;

  @Inject(RedisService)
  private cache: RedisService;

  constructor(private configService: ConfigService) {}

  private log(text: string) {
    this.logger.log(text, SubAppService.name);
  }

  private warn(text: string) {
    this.logger.warn(text, SubAppService.name);
  }

  private async getOneUserApp(owner: number, id: string) {
    const app = await this.appRepo.findOne({
      where: { id },
      relations: { owner: true, meta: true, secrets: true },
    });

    if (isNil(app)) {
      this.warn(`用户#${owner}请求修改不存在的子应用#${id}`);
      BusinessException.throwForbidden();
    } else if (app.owner.id !== owner) {
      this.warn(`用户#${owner}请求操作不属于他的子应用#${id}`);
      BusinessException.throwForbidden();
    }

    return app;
  }

  async create(regData: CreateSubAppDto, owner: number) {
    const app = new SubApp();
    const meta = new SubAppMeta();
    const attrs = ['name', 'callback', 'description'] as const;

    attrs.forEach((key) => {
      app[key] = regData[key];
    });
    app.owner = await this.userRepo.findOneBy({ id: owner });
    app.meta = meta;

    await this.metaRepo.save(meta);
    await this.appRepo.save(app);

    await this.cache.jsonSet(`app-${app.id}`, app.getData());

    return app.getData();
  }

  async findAll(page = 1, limit = 500, search = '') {
    const { items, meta } = await paginate<SubApp>(
      this.appRepo,
      { page, limit },
      {
        where: { name: Like(`%${search}%`) },
        relations: { owner: true, meta: true },
        order: {
          created_at: 'ASC',
        },
      },
    );

    this.log(
      `获取所有子应用信息(page=${page}, size=${limit}, search=${search})，共查询到${meta.totalItems}条结果`,
    );

    return {
      items: items.map((app) => app.getData()),
      count: meta.totalItems,
      total: meta.totalItems,
    };
  }

  async findUserApp(ownerId: number, page = 1, limit = 500, search = '') {
    const { items, meta } = await paginate<SubApp>(
      this.appRepo,
      { page, limit },
      {
        where: { owner: { id: ownerId }, name: Like(`%${search}%`) },
        relations: { owner: true, meta: true },
        order: {
          created_at: 'ASC',
        },
      },
    );

    this.log(
      `获取用户#${ownerId}子应用信息(page=${page}, size=${limit}, search=${search})，共查询到${meta.totalItems}条结果`,
    );

    return {
      items: items.map((app) => ({ ...app.getData() })),
      count: meta.totalItems,
      total: meta.totalItems,
    };
  }

  async findOne(id: string) {
    const cached = await this.cache.jsonGet<SubAppExportData>(`app-${id}`);
    if (cached) {
      return cached;
    }
    const app = await this.appRepo.findOne({
      where: { id },
      relations: { owner: true, meta: true },
    });

    if (isNil(app)) {
      this.warn(`子应用#${id}不存在`);
      throw new BusinessException('子应用不存在');
    }

    await this.cache.jsonSet(`app-${id}`, app.getData());

    return app.getData();
  }

  async callback(appId: string, userId: number) {
    const user = await this.userRepo.findOneBy({ id: userId });
    const app = await this.appRepo.findOne({
      where: { id: appId },
      relations: { owner: true, meta: true },
    });

    if (isNil(user)) {
      this.warn(`不存在的用户#${userId}请求访问子应用#${appId}`);
      throw new BusinessException('用户不存在');
    }

    if (isNil(app)) {
      this.warn(`用户#${userId}请求访问不存在的子应用#${appId}`);
      throw new BusinessException('子应用不存在');
    }

    app.meta.visitNum += 1;
    await this.metaRepo.save(app.meta);

    const ticket = jwt.sign(
      {
        email: user.email,
        role: user.role,
        id: user.id,
        refresh: false,
      },
      this.configService.get<string>('TOKEN_SECRET', ''),
      {
        expiresIn: '1d',
      },
    );

    this.log(`用户#${userId}访问子应用#${appId}成功`);

    await this.cache.jsonSet(`app-${app.id}`, app.getData());

    return {
      ticket,
    };
  }

  async update(id: string, updateData: UpdateSubAppDto, owner: number) {
    const app = await this.getOneUserApp(owner, id);

    const attrs = ['name', 'callback', 'description'] as const;

    attrs.forEach((key) => {
      if (!isNil(updateData[key])) {
        app[key] = updateData[key];
      }
    });

    if (updateData.status !== undefined) {
      app.meta.status = updateData.status;
    }

    await this.metaRepo.save(app.meta);
    await this.appRepo.save(app);

    this.log(`用户#${owner}修改子应用#${id}信息`);
    await this.cache.jsonSet(`app-${app.id}`, app.getData());

    return app.getData();
  }

  async remove(id: string, owner: number) {
    const app = await this.getOneUserApp(owner, id);

    await this.appRepo.remove(app);

    this.log(`用户#${owner}删除了子应用#${id}`);
    await this.cache.del(`app-${id}`);

    return true;
  }

  async createAppSecret(id: string, owner: number) {
    const app = await this.getOneUserApp(owner, id);
    const secret = this.scRepo.create({
      app,
      value: generateRandomString(16),
    });

    app.secrets.push(secret);

    await this.appRepo.save(app);

    this.log(`用户#${owner}为子应用#${id}创建了新的秘钥${secret.value}`);

    return {
      value: secret.value,
      enabled: secret.status,
    };
  }

  async getAppSecret(id: string, owner: number) {
    const app = await this.getOneUserApp(owner, id);

    const secretList = app.secrets.map((s) => ({
      value: `${s.value.slice(0, 8)}********`,
      enabled: s.status,
      id: s.id,
    }));

    this.log(
      `用户#${owner}获取子应用#${id}秘钥列表，共${app.secrets.length}条`,
    );

    return secretList;
  }

  async setAppSecret(app: string, id: number, owner: number) {
    const secret = await this.scRepo.findOneOrFail({
      where: {
        app: {
          owner: {
            id: owner,
          },
          id: app,
        },
        id,
      },
      relations: {
        app: {
          owner: true,
        },
      },
    });

    secret.status = !secret.status;

    await this.scRepo.save(secret);

    this.log(
      `用户#${owner}设置子应用#${id}的秘钥${secret.value}为${secret.status}`,
    );

    return null;
  }

  async delAppSecret(app: string, id: number, owner: number) {
    const secret = await this.scRepo.findOneOrFail({
      where: {
        app: {
          owner: {
            id: owner,
          },
          id: app,
        },
        id,
      },
      relations: {
        app: {
          owner: true,
        },
      },
    });

    await this.scRepo.delete(secret);

    this.log(`用户#${owner}删除子应用#${id}的秘钥${secret.value}`);

    return null;
  }
}
