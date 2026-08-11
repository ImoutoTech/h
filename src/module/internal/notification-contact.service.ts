import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { HLOGGER_TOKEN, HLogger } from '@reus-able/nestjs';
import type { Repository } from 'typeorm';
import { User } from '@/entity';

@Injectable()
export class NotificationContactService {
  @InjectRepository(User) private users: Repository<User>;
  @Inject(HLOGGER_TOKEN) private logger: HLogger;

  async email(userId: number, clientId: string, traceId: string) {
    const user = await this.users.findOne({
      where: { id: userId },
      select: { id: true, email: true, emailVerifiedAt: true },
    });
    const outcome = user?.emailVerifiedAt ? 'available' : 'unavailable';
    const audit =
      `通知联系信息访问 client_id=${clientId} userId=${userId} ` +
      `result=${outcome} traceId=${traceId}`;
    this.logger.log(audit, NotificationContactService.name);
    if (!user?.emailVerifiedAt) return undefined;
    return {
      userId: user.id,
      address: user.email,
      verifiedAt: user.emailVerifiedAt,
    };
  }
}
