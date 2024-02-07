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
import { type Repository, Like } from 'typeorm';
import { paginate } from 'nestjs-typeorm-paginate';
import { BusinessException } from '@/common/exceptions';
import { UserJwtPayload } from '@/utils/types';
import { RedisService } from '../redis/redis.service';
import { HLOGGER_TOKEN, HLogger } from '@reus-able/nestjs';

@Injectable()
export class UserService {
  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  @InjectRepository(User)
  private userRepo: Repository<User>;

  @Inject(RedisService)
  private cache: RedisService;

  constructor(private configService: ConfigService) {}

  private log(text: string) {
    this.logger.log(text, UserService.name);
  }

  private warn(text: string) {
    this.logger.warn(text, UserService.name);
  }

  async create(param: CreateUserDto) {
    if (!isNil(await this.userRepo.findOneBy({ email: param.email }))) {
      this.warn(`用户(email: ${param.email})已存在`);
      throw new BusinessException('邮箱已被注册');
    }

    const user = new User();
    user.email = param.email;
    user.nickname = param.nickname;
    user.password = bcrypt.hashSync(
      param.password,
      +this.configService.get('PWD_SALT_ROUND', 10),
    );

    try {
      await this.userRepo.save(user);
    } catch (e) {
      throw new BusinessException(e.message);
    }

    this.log(`创建用户 ${JSON.stringify(user.getData())} 成功`);
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
    const user = await this.userRepo.findOneBy({ email: param.email });
    if (isNil(user)) {
      this.warn(`不存在的用户${param.email}尝试登录`);
      throw new BusinessException('用户不存在');
    }

    if (!user.checkPassword(param.password)) {
      this.warn(`用户${param.email}登录时密码错误`);
      throw new BusinessException('密码错误');
    }

    const tokenBaseData = {
      email: user.email,
      role: user.role,
      id: user.id,
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
        expiresIn: '7d',
      },
    );

    this.log(`用户${param.email}登录成功`);
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
    const editableProperties = ['avatar', 'nickname', 'email'] as const;
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
}
