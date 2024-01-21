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

@Injectable()
export class UserService {
  private logger = new Logger();

  @InjectRepository(User)
  private userRepo: Repository<User>;

  constructor(private configService: ConfigService) {}

  async create(param: CreateUserDto) {
    if (!isNil(await this.userRepo.findOneBy({ email: param.email }))) {
      this.logger.error(`用户(email: ${param.email})已存在`);
      throw new BusinessException('邮箱已被注册');
    }

    const user = new User();
    user.email = param.email;
    user.nickname = param.nickname;
    user.password = bcrypt.hashSync(
      param.password,
      +this.configService.get('PWD_SALT_ROUND', 10),
    );

    this.logger.log(`创建用户 ${JSON.stringify(user.getData())}`);

    try {
      await this.userRepo.save(user);
    } catch (e) {
      throw new BusinessException(e.message);
    }

    return user.getData();
  }

  async findAll() {
    return (await this.userRepo.find()).map((user) => user.getData());
  }

  async findOne(id: number) {
    const user = await this.userRepo.findOneBy({ id });

    if (isNil(user)) {
      this.logger.error(`用户#${id}不存在`);
      throw new BusinessException('用户不存在');
    }

    return user.getData();
  }

  async login(param: LoginUserDto) {
    const user = await this.userRepo.findOneBy({ email: param.email });
    if (isNil(user)) {
      throw new BusinessException('用户不存在');
    }

    if (!user.checkPassword(param.password)) {
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

    return {
      token,
      refresh,
      user: user.getData(),
    };
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return {
      id,
      updateUserDto,
    };
  }
}
