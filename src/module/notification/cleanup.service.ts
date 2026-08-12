import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { HLOGGER_TOKEN, HLogger } from '@reus-able/nestjs';
import { In, LessThan, type Repository } from 'typeorm';
import { Notification, NotificationDelivery } from '@/entity';

const TERMINAL = ['sent', 'partial_failed', 'failed'] as const;

@Injectable()
export class NotificationCleanupService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  @InjectRepository(Notification) private roots: Repository<Notification>;
  @InjectRepository(NotificationDelivery)
  private deliveries: Repository<NotificationDelivery>;
  @Inject(HLOGGER_TOKEN) private logger: HLogger;
  private timer?: NodeJS.Timeout;

  constructor(private readonly config: ConfigService) {}

  onApplicationBootstrap() {
    if (
      this.config.get<string>('NOTIFICATION_CLEANUP_ENABLED', 'true') !== 'true'
    ) {
      return;
    }
    this.timer = setInterval(() => this.scheduleRun(), 60 * 60 * 1000);
    this.scheduleRun();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  private scheduleRun() {
    void this.run().catch(() =>
      this.logger.warn(
        '通知保留策略清理失败，将在下一轮重试',
        NotificationCleanupService.name,
      ),
    );
  }

  async run(now = new Date()) {
    const purgeBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const deleteBefore = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const roots = await this.roots.find({
      select: { id: true },
      where: { status: In([...TERMINAL]), updatedAt: LessThan(purgeBefore) },
    });
    const ids = roots.map((root) => root.id);
    if (ids.length) {
      await this.deliveries
        .createQueryBuilder()
        .update(NotificationDelivery)
        .set({
          recipientCiphertext: null,
          recipientIv: null,
          recipientTag: null,
          keyVersion: null,
          payloadPurgedAt: now,
        })
        .where('notification_id IN (:...ids)', { ids })
        .andWhere('status IN (:...statuses)', { statuses: ['sent', 'failed'] })
        .andWhere('payload_purged_at IS NULL')
        .execute();
      await this.roots
        .createQueryBuilder()
        .update(Notification)
        .set({
          subjectCiphertext: null,
          subjectIv: null,
          subjectTag: null,
          textCiphertext: null,
          textIv: null,
          textTag: null,
          htmlCiphertext: null,
          htmlIv: null,
          htmlTag: null,
          keyVersion: null,
          payloadPurgedAt: now,
        })
        .whereInIds(ids)
        .andWhere('payload_purged_at IS NULL')
        .execute();
    }
    // The idempotency window is measured from acceptance. Using updatedAt here
    // would extend retention every time payload purge updates the root row.
    await this.roots.delete({
      status: In([...TERMINAL]),
      createdAt: LessThan(deleteBefore),
    });
  }
}
