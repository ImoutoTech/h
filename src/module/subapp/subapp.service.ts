import { Injectable, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Like, type Repository } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import {
  CreateSubAppDto,
  ProvisionConfidentialClientDto,
  SetResourceGrantsDto,
  UpdateSubAppDto,
} from '@/dto';
import {
  User,
  SubAppMeta,
  SubApp,
  type SubAppExportData,
  SubAppSecret,
  SubAppResourceGrant,
} from '@/entity';
import { ConfigService } from '@nestjs/config';
import { paginate } from 'nestjs-typeorm-paginate';
import { BusinessException } from '@reus-able/nestjs';
import { isNil } from 'lodash';
import { HLOGGER_TOKEN, HLogger, RedisService } from '@reus-able/nestjs';
import { generateRandomString } from '@/utils';
import { ClientSecretService } from '../oauth/client-secret.service';
import { isResourceName, RESOURCE_SERVERS } from '../oauth/resource-servers';

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

  @InjectRepository(SubAppResourceGrant)
  private grantRepo: Repository<SubAppResourceGrant>;

  @InjectRepository(User)
  private userRepo: Repository<User>;

  @Inject(RedisService)
  private cache: RedisService;

  constructor(
    private configService: ConfigService,
    private readonly clientSecrets: ClientSecretService,
    private readonly dataSource: DataSource,
  ) {}

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
    app.redirectUris = [regData.callback];
    app.clientType = 'public';
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

    if (!isNil(updateData.callback)) {
      app.redirectUris = [app.callback];
    }

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
    // oidc-provider accepts one shared secret per client. Rotate the aggregate
    // so the newly returned plaintext is always the active credential.
    app.secrets.forEach((item) => {
      item.status = false;
    });
    const plaintext = generateRandomString(32);
    const envelope = this.clientSecrets.encrypt(plaintext, app.id);
    const secret = this.scRepo.create({
      app,
      value: null,
      secretCiphertext: envelope.ciphertext,
      secretIv: envelope.iv,
      secretTag: envelope.tag,
      secretHint: envelope.hint,
      keyVersion: envelope.keyVersion,
    });

    app.secrets.push(secret);

    await this.appRepo.save(app);

    this.log(`用户#${owner}为子应用#${id}创建了新的秘钥#${secret.id}`);

    return {
      value: plaintext,
      enabled: secret.status,
    };
  }

  async getAppSecret(id: string, owner: number) {
    const app = await this.getOneUserApp(owner, id);

    const secretList = app.secrets.map((s) => ({
      value: s.secretHint || '未配置',
      enabled: s.status,
      id: s.id,
    }));

    this.log(
      `用户#${owner}获取子应用#${id}秘钥列表，共${app.secrets.length}条`,
    );

    return secretList;
  }

  async setAppSecret(app: string, id: number, owner: number) {
    const enabled = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(SubAppSecret);
      const secret = await repo.findOneOrFail({
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
      const enabled = !secret.status;
      if (enabled) {
        await repo
          .createQueryBuilder()
          .update(SubAppSecret)
          .set({ status: false })
          .where('appId = :app', { app })
          .execute();
      }
      secret.status = enabled;
      await repo.save(secret);
      return enabled;
    });

    this.log(`用户#${owner}设置子应用#${app}的秘钥#${id}为${enabled}`);

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

    this.log(`用户#${owner}删除子应用#${app}的秘钥#${id}`);

    return null;
  }

  async getResourceGrants(id: string) {
    const app = await this.appRepo.findOneBy({ id });
    if (!app) throw new BusinessException('子应用不存在');
    const grants = await this.grantRepo.find({
      where: { app: { id } },
      relations: { app: true },
      order: { resource: 'ASC', scope: 'ASC' },
    });
    return grants.map(({ resource, scope }) => ({ resource, scope }));
  }

  async setResourceGrants(id: string, body: SetResourceGrantsDto) {
    const app = await this.appRepo.findOneBy({ id });
    if (!app) throw new BusinessException('子应用不存在');
    if (app.clientType !== 'confidential')
      throw new BusinessException('只有 confidential 子应用可以配置机器授权');

    const rows = this.validateGrantRows(app, body.grants);

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(SubAppResourceGrant).delete({ app: { id } });
      if (rows.length)
        await manager.getRepository(SubAppResourceGrant).save(rows);
    });
    this.log(`管理员更新子应用#${id}的机器授权，共${rows.length}条`);
    return rows.map(({ resource, scope }) => ({ resource, scope }));
  }

  async provisionConfidentialClient(
    body: ProvisionConfidentialClientDto,
    ownerId: number,
  ) {
    const owner = await this.userRepo.findOneBy({ id: ownerId });
    if (!owner) throw new BusinessException('用户不存在');
    const plaintext = generateRandomString(32);
    const result = await this.dataSource.transaction(async (manager) => {
      const meta = await manager
        .getRepository(SubAppMeta)
        .save(manager.getRepository(SubAppMeta).create());
      const appRepo = manager.getRepository(SubApp);
      const app = await appRepo.save(
        appRepo.create({
          name: body.name,
          callback: body.callback,
          description: body.description,
          redirectUris: [body.callback],
          clientType: 'confidential',
          owner,
          meta,
        }),
      );
      const envelope = this.clientSecrets.encrypt(plaintext, app.id);
      await manager.getRepository(SubAppSecret).save(
        manager.getRepository(SubAppSecret).create({
          app,
          value: null,
          secretCiphertext: envelope.ciphertext,
          secretIv: envelope.iv,
          secretTag: envelope.tag,
          secretHint: envelope.hint,
          keyVersion: envelope.keyVersion,
          status: true,
        }),
      );
      const grants = this.validateGrantRows(app, body.grants);
      if (grants.length)
        await manager.getRepository(SubAppResourceGrant).save(grants);
      return { app, grants };
    });
    this.log(`管理员预配 confidential 子应用#${result.app.id}`);
    return {
      clientId: result.app.id,
      clientSecret: plaintext,
      grants: result.grants.map(({ resource, scope }) => ({ resource, scope })),
    };
  }

  private validateGrantRows(
    app: SubApp,
    grants: SetResourceGrantsDto['grants'],
  ) {
    const rows = grants.flatMap((grant) => {
      if (!isResourceName(grant.resource))
        throw new BusinessException('不支持的 OAuth resource');
      const allowed = new Set<string>(RESOURCE_SERVERS[grant.resource].scopes);
      return Array.from(new Set(grant.scopes)).map((scope) => {
        if (!allowed.has(scope))
          throw new BusinessException('OAuth scope 与 resource 不匹配');
        return this.grantRepo.create({ app, resource: grant.resource, scope });
      });
    });
    return Array.from(
      new Map(
        rows.map((row) => [`${row.resource}\0${row.scope}`, row]),
      ).values(),
    );
  }
}
