import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Like, type Repository } from 'typeorm';
import { SubApp } from './entities/SubApp';
import { CreateSubAppDto } from './dto/create-subapp.dto';
import { UpdateSubAppDto } from './dto/update-subapp.dto';
import { ConfigService } from '@nestjs/config';
import { paginate } from 'nestjs-typeorm-paginate';
import { BusinessException } from '@/common/exceptions';
import { isNil } from 'lodash';
import { User } from '@/user/entities/user.entity';

@Injectable()
export class SubAppService {
  private logger = new Logger();

  @InjectRepository(SubApp)
  private appRepo: Repository<SubApp>;

  @InjectRepository(User)
  private userRepo: Repository<User>;

  constructor(private configService: ConfigService) {}

  async create(regData: CreateSubAppDto, owner: number) {
    const app = new SubApp();
    const attrs = ['name', 'callback', 'description'] as const;

    attrs.forEach((key) => {
      app[key] = regData[key];
    });
    app.owner = await this.userRepo.findOneBy({ id: owner });

    await this.appRepo.save(app);

    return app.getData();
  }

  async findAll(page = 1, limit = 500, search = '') {
    const { items, meta } = await paginate<SubApp>(
      this.appRepo,
      { page, limit },
      { where: { name: Like(`%${search}%`) }, relations: { owner: true } },
    );

    this.logger.log(
      `获取所有子应用信息(page=${page}, size=${limit}, search=${search})，共查询到${meta.totalItems}条结果`,
    );

    return {
      items: items.map((app) => app.getData()),
      count: meta.totalItems,
      total: meta.totalItems,
    };
  }

  async findUserApp(ownerId: number, page = 1, limit = 500, search = '') {
    const owner = await this.userRepo.findOne({
      where: { id: ownerId },
      relations: { subApps: true },
    });

    const apps = owner.subApps.filter((app) => app.name.includes(search));
    const result = apps.slice((page - 1) * limit, page * limit);

    this.logger.log(
      `获取用户#${ownerId}子应用信息(page=${page}, size=${limit}, search=${search})，共查询到${apps.length}条结果`,
    );

    return {
      items: result.map((app) => app.getData()),
      count: apps.length,
      total: apps.length,
    };
  }

  async findOne(id: string) {
    const app = await this.appRepo.findOneBy({ id });

    if (isNil(app)) {
      this.logger.warn(`子应用#${id}不存在`);
      throw new BusinessException('子应用不存在');
    }

    return app.getData();
  }

  update(id: number, updateSubappDto: UpdateSubAppDto) {
    return `This action updates a #${id} subapp`;
  }

  remove(id: number) {
    return `This action removes a #${id} subapp`;
  }
}
