import { Injectable, Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import {
  CreateUserDto,
  UpdateUserDto,
  LoginUserDto,
  UpdatePasswordDto,
  ChangeEmailDto,
} from '@/dto';
import { EmailVerificationPurpose, User, UserExportData } from '@/entity';

import { isNil } from 'lodash';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, type Repository, Like } from 'typeorm';
import { paginate } from 'nestjs-typeorm-paginate';
import { UserJwtPayload } from '@reus-able/types';
import {
  HLOGGER_TOKEN,
  HLogger,
  BusinessException,
  RedisService,
} from '@reus-able/nestjs';
import { AuthPermissionService } from '../system/permission.service';
import { EmailVerificationService } from './email-verification.service';
import { normalizeEmail } from '@/utils';
import { ActivityWriterService } from '../activity/activity-writer.service';

@Injectable()
export class UserService {
  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  @InjectRepository(User)
  private userRepo: Repository<User>;

  @Inject(RedisService)
  private cache: RedisService;

  constructor(
    private configService: ConfigService,
    private permissionService: AuthPermissionService,
    private dataSource: DataSource,
    private emailVerification: EmailVerificationService,
    private readonly activity: ActivityWriterService,
  ) {}

  private log(text: string) {
    this.logger.log(text, UserService.name);
  }

  private warn(text: string) {
    this.logger.warn(text, UserService.name);
  }

  async create(param: CreateUserDto) {
    try {
      const user = await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(User);
        const email = normalizeEmail(param.email);
        if (await repo.findOneBy({ email }))
          throw new BusinessException('邮箱已被注册');
        await this.emailVerification.consume(
          manager,
          param.verificationProof,
          EmailVerificationPurpose.REGISTER,
          null,
          email,
        );
        return repo.save(
          repo.create({
            email,
            nickname: param.nickname,
            password: bcrypt.hashSync(
              param.password,
              +this.configService.get('PWD_SALT_ROUND', 10),
            ),
            emailVerifiedAt: new Date(),
            emailVerificationSource: 'email_otp',
          }),
        );
      });
      this.log(`创建用户#${user.id}成功`);
      await this.cache.jsonSet(`user-${user.id}`, user.getData());
      return user.getData();
    } catch (error) {
      if (error instanceof BusinessException) throw error;
      throw new BusinessException('注册失败，请稍后重试');
    }
  }

  async findAll(page = 1, limit = 500, search = '') {
    const { items, meta } = await paginate<User>(
      this.userRepo,
      { page, limit },
      { where: { nickname: Like(`%${search}%`) } },
    );

    this.log(
      `获取所有用户信息(page=${page}, size=${limit}, search=${search})，共查询到${meta.totalItems}条结果`,
    );

    return {
      items: items.map((user) => user.getData()),
      count: meta.totalItems,
      total: meta.totalItems,
    };
  }

  async findOne(id: number) {
    const cached = await this.cache.jsonGet<UserExportData>(`user-${id}`);
    if (
      cached &&
      typeof cached.emailVerified === 'boolean' &&
      typeof cached.hasPassword === 'boolean'
    ) {
      return cached;
    }
    const user = await this.userRepo.findOneBy({ id });

    if (isNil(user)) {
      this.warn(`用户#${id}不存在`);
      throw new BusinessException('用户不存在');
    }

    this.log(`获取用户#${id}信息`);
    await this.cache.jsonSet(`user-${user.id}`, user.getData());
    return user.getData();
  }

  async login(param: LoginUserDto) {
    const email = normalizeEmail(param.email);
    const user = await this.userRepo.findOne({
      where: { email },
      relations: ['roles'],
    });
    if (isNil(user)) {
      this.warn('不存在的邮箱账号尝试登录');
      await this.activity.record({
        kind: 'account.login',
        method: 'password',
        outcome: 'failure',
      });
      throw new BusinessException('用户不存在');
    }

    if (!user.checkPassword(param.password)) {
      this.warn(`用户#${user.id}登录时密码错误`);
      await this.activity.record({
        kind: 'account.login',
        actorUserId: user.id,
        method: 'password',
        outcome: 'failure',
      });
      throw new BusinessException('密码错误');
    }

    const session = this.issueSession(user);
    await this.activity.record({
      kind: 'account.login',
      actorUserId: user.id,
      method: 'password',
      outcome: 'success',
    });
    return session;
  }

  issueSession(user: User) {
    const tokenBaseData = {
      email: user.email,
      role: user.role,
      id: user.id,
      roles: user.roles?.map((r) => r.id) || [],
    };

    const token = jwt.sign(
      {
        ...tokenBaseData,
        refresh: false,
      },
      this.configService.get<string>('TOKEN_SECRET', ''),
      {
        expiresIn: '2h',
      },
    );

    const refresh = jwt.sign(
      {
        ...tokenBaseData,
        refresh: true,
      },
      this.configService.get<string>('TOKEN_SECRET', ''),
      {
        expiresIn: '14d',
      },
    );

    this.log(`用户#${user.id}登录成功`);
    return {
      token: `Bearer ${token}`,
      refresh: `Bearer ${refresh}`,
      user: user.getData(),
    };
  }

  async refresh(user: UserJwtPayload) {
    const current = await this.userRepo.findOneBy({ id: user.id });
    if (!current) throw new BusinessException('用户不存在');
    const token = jwt.sign(
      {
        email: current.email,
        role: current.role,
        id: current.id,
        refresh: false,
        roles: user.roles,
      },
      this.configService.get<string>('TOKEN_SECRET', ''),
      {
        expiresIn: '2h',
      },
    );

    this.log(`用户#${user.id}刷新token成功`);
    return {
      token: `Bearer ${token}`,
    };
  }

  async update(id: number, userNewData: UpdateUserDto) {
    const editableProperties = ['avatar', 'nickname'] as const;
    const editedProperties: Array<(typeof editableProperties)[number]> = [];
    const user = await this.userRepo.findOneBy({ id });

    if (isNil(user)) {
      this.warn(`不存在的用户#${id}尝试修改信息`);
      throw new BusinessException('用户不存在');
    }

    editableProperties.forEach((key) => {
      if (!isNil(userNewData[key])) {
        user[key] = userNewData[key];
        editedProperties.push(key);
      }
    });

    await this.userRepo.save(user);
    this.log(`用户#${user.id}修改了${editedProperties.join(',')}`);

    await this.cache.jsonSet(`user-${user.id}`, user.getData());

    if (editedProperties.length) {
      await this.activity.record({
        kind: 'account.changed',
        actorUserId: user.id,
        action: 'profile_updated',
        changedFields: editedProperties,
      });
    }

    return user.getData();
  }

  async updatePassword(id: number, newData: UpdatePasswordDto) {
    const user = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(User);
      const locked = await repo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new BusinessException('用户不存在');
      if (
        locked.password &&
        (!newData.oldVal || !locked.checkPassword(newData.oldVal))
      ) {
        this.warn(`用户#${id}尝试使用错误的老密码修改密码`);
        throw new BusinessException('原密码错误');
      }
      await this.emailVerification.consume(
        manager,
        newData.verificationProof,
        EmailVerificationPurpose.CHANGE_PASSWORD,
        id,
        locked.email,
      );
      locked.password = bcrypt.hashSync(
        newData.newVal,
        +this.configService.get('PWD_SALT_ROUND', 10),
      );
      return repo.save(locked);
    });
    this.log(`用户#${id}修改密码成功`);
    await this.cache.jsonSet(`user-${id}`, user.getData());
    await this.activity.record({
      kind: 'account.changed',
      actorUserId: id,
      action: 'password_changed',
    });
    return user.getData();
  }

  async changeEmail(id: number, input: ChangeEmailDto) {
    const user = await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(User);
      const locked = await repo.findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked) throw new BusinessException('用户不存在');
      const email = normalizeEmail(input.email);
      if (await repo.findOneBy({ email }))
        throw new BusinessException('邮箱已被注册');
      await this.emailVerification.consume(
        manager,
        input.verificationProof,
        EmailVerificationPurpose.CHANGE_EMAIL,
        id,
        email,
      );
      locked.email = email;
      locked.emailVerifiedAt = new Date();
      locked.emailVerificationSource = 'email_otp';
      return repo.save(locked);
    });
    await this.cache.jsonSet(`user-${id}`, user.getData());
    this.log(`用户#${id}完成邮箱换绑`);
    await this.activity.record({
      kind: 'account.changed',
      actorUserId: id,
      action: 'email_changed',
    });
    return user.getData();
  }

  async getUserPermission(id: number) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['roles'],
    });
    if (isNil(user)) {
      this.warn(`不存在的用户#${id}尝试获取权限`);
      throw new BusinessException('用户不存在');
    }

    const permissions = await this.permissionService.getPermissionByRoles(
      user.roles.map((r) => String(r.id)),
    );

    this.log(`用户#${id}获取自身权限完成`);

    return permissions;
  }
}
