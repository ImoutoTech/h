import { Injectable, Logger } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';

import { isNil } from 'lodash';
import { InjectEntityManager } from '@nestjs/typeorm';
import type { EntityManager } from 'typeorm';
import { BusinessException } from '@/common/exceptions';

@Injectable()
export class UserService {
  private logger = new Logger();

  @InjectEntityManager()
  private manager: EntityManager;

  create(createUserDto: CreateUserDto) {
    return createUserDto;
  }

  findAll() {
    return this.manager.find(User);
  }

  async findOne(id: number) {
    const user = (await this.manager.find(User, { where: { id } }))?.[0];

    if (isNil(user)) {
      this.logger.error(`用户#${id}不存在`);
      throw new BusinessException('用户不存在');
    }

    return user.getData();
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return {
      id,
      updateUserDto,
    };
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
