import { randomUUID } from 'crypto';
import {
  Inject,
  Injectable,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { HLOGGER_TOKEN, HLogger } from '@reus-able/nestjs';
import type { Repository } from 'typeorm';
import {
  Notification,
  NotificationChannelConfig,
  NotificationDelivery,
} from '@/entity';
import { ChannelAdapterRegistry } from './channel-adapter';
import { NotificationEnvelopeService } from './notification-envelope';
import type { ChannelSendResult } from './notification.types';

const BACKOFF_MS = [60_000, 300_000, 1_800_000, 7_200_000];
const LEASE_MS = 5 * 60_000;

@Injectable()
export class NotificationDispatcher
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  @InjectRepository(NotificationDelivery)
  private deliveries: Repository<NotificationDelivery>;
  @InjectRepository(Notification)
  private notifications: Repository<Notification>;
  @InjectRepository(NotificationChannelConfig)
  private channels: Repository<NotificationChannelConfig>;
  @Inject(HLOGGER_TOKEN) private logger: HLogger;
  private timer?: NodeJS.Timeout;
  private running = false;
  private readonly workerId = `h:${process.pid}:${randomUUID()}`;

  constructor(
    private readonly config: ConfigService,
    private readonly registry: ChannelAdapterRegistry,
    private readonly envelopes: NotificationEnvelopeService,
  ) {}

  async onApplicationBootstrap() {
    if (
      this.config.get<string>('NOTIFICATION_DISPATCHER_ENABLED', 'false') !==
      'true'
    ) {
      return;
    }
    // Validate both the current write key and every retained ciphertext version
    // before background work starts. Rotation may add keys, never strand data.
    this.envelopes.encrypt('startup-validation', 'notification-startup');
    await this.validateRetainedKeyVersions();
    const interval = this.config.get<number>(
      'NOTIFICATION_POLL_INTERVAL_MS',
      5000,
    );
    this.timer = setInterval(() => this.scheduleTick(), interval);
    this.scheduleTick();
  }

  private async validateRetainedKeyVersions() {
    const [rootRows, deliveryRows, channelRows] = await Promise.all([
      this.notifications
        .createQueryBuilder('notification')
        .select('DISTINCT notification.keyVersion', 'version')
        .where('notification.subjectCiphertext IS NOT NULL')
        .getRawMany<{ version: string }>(),
      this.deliveries
        .createQueryBuilder('delivery')
        .select('DISTINCT delivery.keyVersion', 'version')
        .where('delivery.recipientCiphertext IS NOT NULL')
        .getRawMany<{ version: string }>(),
      this.channels
        .createQueryBuilder('channel')
        .select('DISTINCT channel.keyVersion', 'version')
        .where('channel.passwordCiphertext IS NOT NULL')
        .getRawMany<{ version: string }>(),
    ]);
    const versions = new Set(
      [...rootRows, ...deliveryRows, ...channelRows]
        .map((row) => row.version)
        .filter(Boolean),
    );
    versions.forEach((version) =>
      this.envelopes.assertVersionAvailable(version),
    );
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  private scheduleTick() {
    void this.tick().catch(() =>
      this.logger.warn(
        '通知投递轮询失败，将在下一轮重试',
        NotificationDispatcher.name,
      ),
    );
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      for (const id of await this.candidates(20)) {
        if (await this.claim(id)) await this.deliver(id);
      }
    } finally {
      this.running = false;
    }
  }

  private async candidates(limit: number) {
    const now = new Date();
    const rows = await this.deliveries
      .createQueryBuilder('delivery')
      .select('delivery.id', 'id')
      .where(
        '(delivery.status = :pending AND (delivery.nextAttemptAt IS NULL OR delivery.nextAttemptAt <= :now))',
        { pending: 'pending', now },
      )
      .orWhere(
        '(delivery.status = :processing AND delivery.leaseExpiresAt <= :now)',
        { processing: 'processing', now },
      )
      .orderBy('delivery.nextAttemptAt', 'ASC')
      .limit(limit)
      .getRawMany<{ id: string }>();
    return rows.map((row) => row.id);
  }

  private async claim(id: string) {
    const now = new Date();
    const expiry = new Date(now.getTime() + LEASE_MS);
    const result = await this.deliveries
      .createQueryBuilder()
      .update(NotificationDelivery)
      .set({
        status: 'processing',
        leaseOwner: this.workerId,
        leaseExpiresAt: expiry,
      })
      .where('id = :id', { id })
      .andWhere(
        '((status = :pending AND (next_attempt_at IS NULL OR next_attempt_at <= :now)) OR (status = :processing AND lease_expires_at <= :now))',
        { pending: 'pending', processing: 'processing', now },
      )
      .execute();
    return result.affected === 1;
  }

  private async deliver(id: string) {
    const delivery = await this.deliveries.findOne({
      where: { id, leaseOwner: this.workerId, status: 'processing' },
      relations: { notification: true },
    });
    if (!delivery) return;
    if (
      delivery.attempts >= 5 ||
      Date.now() - delivery.createdAt.getTime() >= 24 * 60 * 60 * 1000
    ) {
      await this.finish(delivery, {
        accepted: false,
        retryable: false,
        errorClass: 'retry_exhausted',
      });
      return;
    }
    let result: ChannelSendResult;
    try {
      const root = delivery.notification;
      await this.aggregate(root.id);
      const contentPurpose = `notification-content:${root.id}`;
      const recipient = this.envelopes.decrypt(
        {
          ciphertext: delivery.recipientCiphertext,
          iv: delivery.recipientIv,
          tag: delivery.recipientTag,
          keyVersion: delivery.keyVersion,
        },
        `notification-recipient:${delivery.id}`,
      );
      result = await this.registry.resolve(root.channelType).send({
        to: recipient,
        subject: this.decryptContent(
          root.subjectCiphertext,
          root.subjectIv,
          root.subjectTag,
          root.keyVersion,
          contentPurpose,
        ),
        text: this.decryptContent(
          root.textCiphertext,
          root.textIv,
          root.textTag,
          root.keyVersion,
          contentPurpose,
        ),
        html: root.htmlCiphertext
          ? this.decryptContent(
              root.htmlCiphertext,
              root.htmlIv,
              root.htmlTag,
              root.keyVersion,
              contentPurpose,
            )
          : undefined,
      });
    } catch {
      result = {
        accepted: false,
        retryable: true,
        errorClass: 'delivery_infrastructure',
      };
    }
    await this.finish(delivery, result);
  }

  private decryptContent(
    ciphertext: string,
    iv: string,
    tag: string,
    keyVersion: string,
    purpose: string,
  ) {
    return this.envelopes.decrypt({ ciphertext, iv, tag, keyVersion }, purpose);
  }

  private async finish(
    delivery: NotificationDelivery,
    result: ChannelSendResult,
  ) {
    const failure = result.accepted
      ? null
      : (result as Extract<ChannelSendResult, { accepted: false }>);
    const unavailable = failure?.errorClass === 'channel_unavailable';
    const attempts = unavailable ? delivery.attempts : delivery.attempts + 1;
    const age = Date.now() - delivery.createdAt.getTime();
    const exhausted =
      age >= 24 * 60 * 60 * 1000 || (!unavailable && attempts >= 5);
    delivery.attempts = attempts;
    delivery.leaseOwner = null;
    delivery.leaseExpiresAt = null;
    if (result.accepted) {
      delivery.status = 'sent';
      delivery.sentAt = new Date();
      delivery.errorClass = null;
      delivery.nextAttemptAt = null;
    } else if (failure.retryable && !exhausted) {
      delivery.status = 'pending';
      delivery.errorClass = failure.errorClass;
      delivery.nextAttemptAt = new Date(
        Date.now() +
          (unavailable
            ? 300_000
            : BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)]),
      );
    } else {
      delivery.status = 'failed';
      delivery.errorClass = exhausted ? 'retry_exhausted' : failure.errorClass;
      delivery.nextAttemptAt = null;
    }
    const update = await this.deliveries
      .createQueryBuilder()
      .update(NotificationDelivery)
      .set({
        status: delivery.status,
        attempts: delivery.attempts,
        leaseOwner: null,
        leaseExpiresAt: null,
        errorClass: delivery.errorClass,
        sentAt: delivery.sentAt,
        nextAttemptAt: delivery.nextAttemptAt,
      })
      .where('id = :id', { id: delivery.id })
      .andWhere('status = :status', { status: 'processing' })
      .andWhere('lease_owner = :leaseOwner', { leaseOwner: this.workerId })
      .execute();
    // A lease can expire during an uncertain SMTP result window. If another
    // worker reclaimed it, the stale worker must not overwrite the new owner.
    if (update.affected !== 1) return;
    this.logger.log(
      `通知投递 notification=${delivery.notification.id} delivery=${delivery.id} channel=email attempt=${attempts} status=${delivery.status} error=${delivery.errorClass || 'none'}`,
      NotificationDispatcher.name,
    );
    await this.aggregate(delivery.notification.id);
  }

  async aggregate(notificationId: string) {
    // Recompute all counters and the root state in one statement so two
    // concurrently completing deliveries cannot publish a stale aggregate.
    await this.notifications.query(
      `UPDATE notifications AS notification
       INNER JOIN (
         SELECT notification_id,
                COUNT(*) AS total_count,
                SUM(status = 'sent') AS sent_count,
                SUM(status = 'failed') AS failed_count,
                SUM(status = 'processing') AS processing_count
         FROM notification_deliveries
         WHERE notification_id = ?
         GROUP BY notification_id
       ) AS delivery_counts
         ON delivery_counts.notification_id = notification.id
       SET notification.total_count = delivery_counts.total_count,
           notification.sent_count = delivery_counts.sent_count,
           notification.failed_count = delivery_counts.failed_count,
           notification.status = CASE
             WHEN delivery_counts.sent_count + delivery_counts.failed_count = delivery_counts.total_count
               THEN CASE
                 WHEN delivery_counts.failed_count = 0 THEN 'sent'
                 WHEN delivery_counts.sent_count = 0 THEN 'failed'
                 ELSE 'partial_failed'
               END
             WHEN delivery_counts.processing_count > 0 THEN 'processing'
             ELSE 'pending'
           END
       WHERE notification.id = ?`,
      [notificationId, notificationId],
    );
  }
}
