import { Module } from '@nestjs/common';
import { SubAppService } from './subapp.service';
import { SubAppController } from './subapp.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubApp } from './entities/SubApp';
import { SubAppMeta } from './entities/SubAppMeta';
import { User } from '@/user/entities/user.entity';
import { ConfigModule } from '@nestjs/config';

@Module({
  controllers: [SubAppController],
  providers: [SubAppService],
  imports: [ConfigModule, TypeOrmModule.forFeature([SubApp, User, SubAppMeta])],
})
export class SubappModule {}
