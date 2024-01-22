import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { type Repository } from 'typeorm';
import { SubApp } from './entities/SubApp';
import { CreateSubappDto } from './dto/create-subapp.dto';
import { UpdateSubappDto } from './dto/update-subapp.dto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SubAppService {
  private logger = new Logger();

  @InjectRepository(SubApp)
  private repo: Repository<SubApp>;

  constructor(private configService: ConfigService) {}

  create(createSubappDto: CreateSubappDto) {
    return 'This action adds a new subapp';
  }

  findAll() {
    return this.repo.find();
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
