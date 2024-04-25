import { Module } from '@nestjs/common';
import { SubAppService } from './subapp.service';
import { SubAppController } from './subapp.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubApp, SubAppMeta, User, SubAppSecret } from '@/entity';
import { ConfigModule } from '@nestjs/config';

@Module({
  controllers: [SubAppController],
  providers: [SubAppService],
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([SubApp, User, SubAppMeta, SubAppSecret]),
  ],
})
export class SubappModule {}
