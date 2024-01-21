import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import { CreateUserDto, UpdateUserDto, LoginUserDto } from './dto';
import { User } from './entities/user.entity';

import { isNil } from 'lodash';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';
import { BusinessException } from '@/common/exceptions';
import { UserJwtPayload } from '@/utils/types';

@Injectable()
export class UserService {
  private logger = new Logger();

  @InjectRepository(User)
  private userRepo: Repository<User>;

  constructor(private configService: ConfigService) {}

  async create(param: CreateUserDto) {
    if (!isNil(await this.userRepo.findOneBy({ email: param.email }))) {
      this.logger.warn(`用户(email: ${param.email})已存在`);
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

    this.logger.log(`创建用户 ${JSON.stringify(user.getData())} 成功`);
    return user.getData();
  }

  async findAll() {
    this.logger.log(`获取所有用户信息`);
    return (await this.userRepo.find()).map((user) => user.getData());
  }

  async findOne(id: number) {
    const user = await this.userRepo.findOneBy({ id });

    if (isNil(user)) {
      this.logger.warn(`用户#${id}不存在`);
      throw new BusinessException('用户不存在');
    }

    this.logger.log(`获取用户#${id}信息`);
    return user.getData();
  }

  async login(param: LoginUserDto) {
    const user = await this.userRepo.findOneBy({ email: param.email });
    if (isNil(user)) {
      this.logger.warn(`不存在的用户${param.email}尝试登录`);
      throw new BusinessException('用户不存在');
    }

    if (!user.checkPassword(param.password)) {
      this.logger.warn(`用户${param.email}登录时密码错误`);
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

    this.logger.log(`用户${param.email}登录成功`);
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

    this.logger.log(`用户#${user.id}刷新token成功`);
    return {
      token: `Bearer ${token}`,
    };
  }

  async update(id: number, userNewData: UpdateUserDto) {
    const editableProperties = ['avatar', 'nickname', 'email'] as const;
    const editedProperties: string[] = [];
    const user = await this.userRepo.findOneBy({ id });

    if (isNil(user)) {
      this.logger.warn(`不存在的用户#${id}尝试修改信息`);
      throw new BusinessException('用户不存在');
    }

    editableProperties.forEach((key) => {
      if (!isNil(userNewData[key])) {
        user[key] = userNewData[key];
        editedProperties.push(key);
      }
    });

    await this.userRepo.save(user);
    this.logger.log(`用户#${user.id}修改了${editedProperties.join(',')}`);

    return user.getData();
  }
}
