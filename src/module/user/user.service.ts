import { Injectable, Inject } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import {
  CreateUserDto,
  UpdateUserDto,
  LoginUserDto,
  UpdatePasswordDto,
} from '@/dto';
import { User, UserExportData } from '@/entity';

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
import { normalizeEmail } from './email-verification-code';

@Injectable()
export class UserService {
  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  @InjectRepository(User)
  private userRepo: Repository<User>;

  @Inject(RedisService)
  private cache: RedisService;

  @Inject(DataSource)
  private dataSource: DataSource;

  @Inject(EmailVerificationService)
  private emailVerification: EmailVerificationService;

  constructor(
    private configService: ConfigService,
    private permissionService: AuthPermissionService,
  ) {}

  private log(text: string) {
    this.logger.log(text, UserService.name);
  }

  private warn(text: string) {
    this.logger.warn(text, UserService.name);
  }

  async create(param: CreateUserDto) {
    const normalizedEmail = normalizeEmail(param.email);
    let user: User;
    try {
      user = await this.dataSource.transaction(async (manager) => {
        const users = manager.getRepository(User);
        if (!isNil(await users.findOneBy({ email: normalizedEmail })))
          throw new BusinessException('邮箱已被注册');
        const challenge = await this.emailVerification.consume(
          manager,
          param.emailVerificationChallengeId,
          { purpose: 'register', normalizedEmail },
        );
        const created = users.create({
          email: normalizedEmail,
          emailVerifiedAt: challenge.verifiedAt,
          emailVerificationSource: 'email_otp',
          nickname: param.nickname,
          password: bcrypt.hashSync(
            param.password,
            +this.configService.get('PWD_SALT_ROUND', 10),
          ),
        });
        return users.save(created);
      });
    } catch (reason) {
      if (reason instanceof BusinessException) throw reason;
      if (this.isDuplicate(reason)) throw new BusinessException('邮箱已被注册');
      throw reason;
    }

    this.log(`创建用户#${user.id}成功`);
    await this.cache.jsonSet(`user-${user.id}`, user.getData());
    return user.getData();
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
    if (cached) {
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
    const user = await this.userRepo.findOne({
      where: { email: param.email },
      relations: ['roles'],
    });
    if (isNil(user)) {
      this.warn('未知邮箱的登录尝试');
      throw new BusinessException('用户不存在');
    }

    if (!user.checkPassword(param.password)) {
      this.warn(`用户#${user.id}登录时密码错误`);
      throw new BusinessException('密码错误');
    }

    return this.issueSession(user);
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

  refresh(user: UserJwtPayload) {
    const token = jwt.sign(
      {
        email: user.email,
        role: user.role,
        id: user.id,
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
    if (Object.prototype.hasOwnProperty.call(userNewData, 'email'))
      throw new BusinessException('请通过邮箱验证流程修改邮箱');
    const editableProperties = ['avatar', 'nickname'] as const;
    const editedProperties: string[] = [];
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

    return user.getData();
  }

  async changeEmail(id: number, challengeId: string) {
    let user: User;
    try {
      user = await this.dataSource.transaction(async (manager) => {
        const users = manager.getRepository(User);
        const current = await users.findOne({
          where: { id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!current) throw new BusinessException('用户不存在');
        const challenge = await this.emailVerification.consume(
          manager,
          challengeId,
          {
            purpose: 'change_email',
            userId: id,
          },
        );
        const owner = await users.findOneBy({
          email: challenge.normalizedEmail,
        });
        if (owner && owner.id !== id)
          throw new BusinessException('邮箱已被注册');
        current.email = challenge.normalizedEmail;
        current.emailVerifiedAt = challenge.verifiedAt;
        current.emailVerificationSource = 'email_otp';
        return users.save(current);
      });
    } catch (reason) {
      if (reason instanceof BusinessException) throw reason;
      if (this.isDuplicate(reason)) throw new BusinessException('邮箱已被注册');
      throw reason;
    }
    await this.cache.jsonSet(`user-${user.id}`, user.getData());
    this.log(`用户#${user.id}修改已验证邮箱成功`);
    return user.getData();
  }

  async updatePassword(id: number, newData: UpdatePasswordDto) {
    const user = await this.userRepo.findOneBy({ id });

    if (isNil(user)) {
      this.warn(`不存在的用户#${id}尝试修改密码`);
      throw new BusinessException('用户不存在');
    }

    if (!user.checkPassword(newData.oldVal)) {
      this.warn(`用户#${id}尝试使用错误的老密码修改密码`);
      throw new BusinessException('原密码错误');
    }

    user.password = bcrypt.hashSync(
      newData.newVal,
      +this.configService.get('PWD_SALT_ROUND', 10),
    );
    await this.userRepo.save(user);
    this.log(`用户#${id}修改密码成功`);

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

  private isDuplicate(reason: any) {
    return (
      reason?.code === 'ER_DUP_ENTRY' ||
      reason?.driverError?.code === 'ER_DUP_ENTRY'
    );
  }
}
