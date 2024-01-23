import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, type Repository } from 'typeorm';
import { SubApp } from './entities/SubApp';
import { CreateSubappDto } from './dto/create-subapp.dto';
import { UpdateSubappDto } from './dto/update-subapp.dto';
import { ConfigService } from '@nestjs/config';
import { paginate } from 'nestjs-typeorm-paginate';

@Injectable()
export class SubAppService {
  private logger = new Logger();

  @InjectRepository(SubApp)
  private repo: Repository<SubApp>;

  constructor(private configService: ConfigService) {}

  create(createSubappDto: CreateSubappDto) {
    return 'This action adds a new subapp';
  }

  async findAll(page = 1, limit = 500, search = '') {
    const { items, meta } = await paginate<SubApp>(
      this.repo,
      { page, limit },
      { where: { name: Like(`%${search}%`) }, relations: { owner: true } },
    );

    this.logger.log(
      `获取所有子应用信息(page=${page}, size=${limit}, search=${search})，共查询到${meta.totalItems}条结果`,
    );

    return {
      items: items.map((user) => user.getData()),
      count: meta.totalItems,
      total: meta.totalItems,
    };
  }

  findOne(id: number) {
    return `This action returns a #${id} subapp`;
  }

  update(id: number, updateSubappDto: UpdateSubappDto) {
    return `This action updates a #${id} subapp`;
  }

  remove(id: number) {
    return `This action removes a #${id} subapp`;
  }
}
