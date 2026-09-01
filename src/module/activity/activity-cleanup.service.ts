import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { HLOGGER_TOKEN, HLogger } from '@reus-able/nestjs';
import { LessThan, type Repository } from 'typeorm';
import { UserActivityEvent } from '@/entity';

export const DEFAULT_ACTIVITY_RETENTION_DAYS = 90;

@Injectable()
export class ActivityCleanupService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  @InjectRepository(UserActivityEvent)
  private readonly events: Repository<UserActivityEvent>;

  @Inject(HLOGGER_TOKEN)
  private readonly logger: HLogger;

  private timer?: NodeJS.Timeout;

  constructor(private readonly config: ConfigService) {}

  get retentionDays() {
    const configured = this.config.get<string>(
      'USER_ACTIVITY_RETENTION_DAYS',
      String(DEFAULT_ACTIVITY_RETENTION_DAYS),
    );
    if (!/^[1-9]\d*$/.test(configured)) return DEFAULT_ACTIVITY_RETENTION_DAYS;
    const value = Number(configured);
    return Number.isInteger(value) && value > 0 && value <= 3650
      ? value
      : DEFAULT_ACTIVITY_RETENTION_DAYS;
  }

  onApplicationBootstrap() {
    if (
      this.config.get<string>('USER_ACTIVITY_CLEANUP_ENABLED', 'true') !==
      'true'
    ) {
      return;
    }
    this.timer = setInterval(() => this.scheduleRun(), 60 * 60 * 1000);
    this.timer.unref?.();
    this.scheduleRun();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  private scheduleRun() {
    void this.run().catch(() =>
      this.logger.warn(
        '用户活动事件清理失败，将在下一轮重试',
        ActivityCleanupService.name,
      ),
    );
  }

  async run(now = new Date()) {
    const cutoff = new Date(
      now.getTime() - this.retentionDays * 24 * 60 * 60 * 1000,
    );
    return this.events.delete({ occurredAt: LessThan(cutoff) });
  }
}
