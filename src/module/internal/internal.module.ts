import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/entity';
import { ContactTokenService } from './contact-token.service';
import { InternalController } from './internal.controller';
import { NotificationContactService } from './notification-contact.service';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [InternalController],
  providers: [ContactTokenService, NotificationContactService],
})
export class InternalModule {}
