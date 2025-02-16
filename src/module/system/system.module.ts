import { Module } from '@nestjs/common';
import { SystemService } from './system.service';
import { SystemController } from './system.controller';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role, Permission } from '@/entity';

@Module({
  controllers: [SystemController],
  providers: [SystemService],
  imports: [ConfigModule, TypeOrmModule.forFeature([Role, Permission])],
})
export class SystemModule {}
