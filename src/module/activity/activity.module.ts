import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExternalIdentity, SubApp, User, UserActivityEvent } from '@/entity';
import { SystemModule } from '../system/system.module';
import { ActivityCleanupService } from './activity-cleanup.service';
import { ActivityController } from './activity.controller';
import { ActivityQueryService } from './activity-query.service';
import { ActivityWriterService } from './activity-writer.service';

@Module({
  imports: [
    ConfigModule,
    SystemModule,
    TypeOrmModule.forFeature([
      UserActivityEvent,
      User,
      ExternalIdentity,
      SubApp,
    ]),
  ],
  controllers: [ActivityController],
  providers: [
    ActivityWriterService,
    ActivityQueryService,
    ActivityCleanupService,
  ],
  exports: [ActivityWriterService],
})
export class ActivityModule {}
