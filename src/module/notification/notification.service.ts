import { createHash, createHmac, randomUUID } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, type Repository } from 'typeorm';
import { isEmail } from 'class-validator';
import {
  Notification,
  NotificationChannelConfig,
  NotificationDelivery,
  NotificationTemplate,
  User,
} from '@/entity';
import { NotificationEnvelopeService } from './notification-envelope';
import { notificationError } from './notification-error';
import { NotificationPolicyService } from './policy.service';
import { NotificationRateLimiter } from './rate-limiter.service';
import { TemplateRenderer } from './template-renderer';
import type {
  NotificationApplication,
  NotificationCaller,
  NotificationStatusProjection,
  RenderedNotificationContent,
  SubmitNotificationCommand,
} from './notification.types';

@Injectable()
export class NotificationService implements NotificationApplication {
  @InjectRepository(Notification) private repo: Repository<Notification>;
  @InjectRepository(NotificationDelivery)
  private deliveryRepo: Repository<NotificationDelivery>;
  @InjectRepository(NotificationTemplate)
  private templateRepo: Repository<NotificationTemplate>;
  @InjectRepository(User) private userRepo: Repository<User>;
  @InjectRepository(NotificationChannelConfig)
  private channelRepo: Repository<NotificationChannelConfig>;

  constructor(
    private readonly policies: NotificationPolicyService,
    private readonly renderer: TemplateRenderer,
    private readonly envelopes: NotificationEnvelopeService,
    private readonly limits: NotificationRateLimiter,
    private readonly config: ConfigService,
  ) {}

  async submit(command: SubmitNotificationCommand) {
    this.validateCommand(command);
    const callerKey =
      command.caller.kind === 'subapp'
        ? `app:${command.caller.appId}`
        : `internal:${command.caller.name}`;
    const policy =
      command.caller.kind === 'subapp'
        ? await this.policies.effective(command.caller.appId)
        : null;
    const recipients = await this.resolveRecipients(
      command.recipients,
      command.caller,
      policy?.manualRecipient || false,
    );
    const content = await this.resolveContent(command, policy);
    const requestHash = this.hash({
      recipients: [...recipients].sort(),
      content,
      channelType: 'email',
    });
    if (command.idempotencyKey) {
      const existing = await this.repo.findOneBy({
        callerKey,
        idempotencyKey: command.idempotencyKey,
      });
      if (existing) {
        if (existing.requestHash !== requestHash)
          notificationError('notification_idempotency_conflict');
        return { notificationId: existing.id };
      }
    }
    const channel = await this.channelRepo.findOneBy({ channelType: 'email' });
    if (
      !channel?.enabled ||
      !channel.host ||
      !channel.port ||
      !channel.username ||
      !channel.passwordCiphertext ||
      !channel.fromAddress
    ) {
      notificationError('notification_channel_unavailable');
    }
    await this.limits.consume(callerKey, recipients.length);

    const notificationId = randomUUID();
    const subject = this.envelopes.encrypt(
      content.subject,
      `notification-content:${notificationId}`,
    );
    const text = this.envelopes.encrypt(
      content.text,
      `notification-content:${notificationId}`,
    );
    const html = content.html
      ? this.envelopes.encrypt(
          content.html,
          `notification-content:${notificationId}`,
        )
      : null;
    const notification = this.repo.create({
      id: notificationId,
      callerKind: command.caller.kind,
      callerKey,
      appId: command.caller.kind === 'subapp' ? command.caller.appId : null,
      internalName:
        command.caller.kind === 'internal' ? command.caller.name : null,
      idempotencyKey: command.idempotencyKey || null,
      requestHash,
      channelType: 'email',
      subjectCiphertext: subject.ciphertext,
      subjectIv: subject.iv,
      subjectTag: subject.tag,
      textCiphertext: text.ciphertext,
      textIv: text.iv,
      textTag: text.tag,
      htmlCiphertext: html?.ciphertext || null,
      htmlIv: html?.iv || null,
      htmlTag: html?.tag || null,
      keyVersion: subject.keyVersion,
      status: 'pending',
      totalCount: recipients.length,
      sentCount: 0,
      failedCount: 0,
    });
    const now = new Date();
    const deliveries = recipients.map((recipient) => {
      const id = randomUUID();
      const encrypted = this.envelopes.encrypt(
        recipient,
        `notification-recipient:${id}`,
      );
      return this.deliveryRepo.create({
        id,
        notification,
        recipientCiphertext: encrypted.ciphertext,
        recipientIv: encrypted.iv,
        recipientTag: encrypted.tag,
        recipientDigest: this.recipientDigest(recipient),
        keyVersion: encrypted.keyVersion,
        status: 'pending',
        attempts: 0,
        nextAttemptAt: now,
      });
    });
    try {
      await this.repo.manager.transaction(async (manager) => {
        await manager.getRepository(Notification).save(notification);
        await manager.getRepository(NotificationDelivery).save(deliveries);
      });
    } catch (reason) {
      if (command.idempotencyKey) {
        const existing = await this.repo.findOneBy({
          callerKey,
          idempotencyKey: command.idempotencyKey,
        });
        if (existing?.requestHash === requestHash)
          return { notificationId: existing.id };
        if (existing) notificationError('notification_idempotency_conflict');
      }
      throw reason;
    }
    return { notificationId };
  }

  async status(
    caller: NotificationCaller,
    id: string,
  ): Promise<NotificationStatusProjection> {
    const where =
      caller.kind === 'subapp'
        ? { id, appId: caller.appId, callerKind: 'subapp' as const }
        : { id, internalName: caller.name, callerKind: 'internal' as const };
    const item = await this.repo.findOne({
      where,
      relations: { deliveries: true },
    });
    if (!item) notificationError('notification_not_found');
    const errorClasses: Record<string, number> = {};
    item.deliveries.forEach((delivery) => {
      if (delivery.errorClass) {
        errorClasses[delivery.errorClass] =
          (errorClasses[delivery.errorClass] || 0) + 1;
      }
    });
    return {
      notificationId: item.id,
      status: item.status,
      total: item.totalCount,
      sent: item.sentCount,
      failed: item.failedCount,
      pending: item.totalCount - item.sentCount - item.failedCount,
      errorClasses,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  private async resolveRecipients(
    targets: SubmitNotificationCommand['recipients'],
    caller: NotificationCaller,
    manualRecipient: boolean,
  ) {
    if (!targets.length) notificationError('notification_invalid_recipient');
    if (targets.length > 100)
      notificationError('notification_too_many_recipients');
    const userIds = targets
      .filter((target) => target.kind === 'user')
      .map((target: { kind: 'user'; userId: number }) => target.userId);
    if (userIds.some((id) => !Number.isInteger(id) || id < 1))
      notificationError('notification_invalid_recipient');
    const users = userIds.length
      ? await this.userRepo.findBy({ id: In([...new Set(userIds)]) })
      : [];
    const byId = new Map(users.map((user) => [user.id, user.email]));
    if (users.length !== new Set(userIds).size)
      notificationError('notification_invalid_recipient');
    const resolved: string[] = [];
    for (const target of targets) {
      if (target.kind === 'user') {
        const email = byId.get(target.userId);
        if (!email || !isEmail(email))
          notificationError('notification_invalid_recipient');
        resolved.push(email.trim().toLowerCase());
      } else if (target.kind === 'email') {
        if (caller.kind === 'subapp' && !manualRecipient)
          notificationError('notification_insufficient_capability');
        if (!target.email || !isEmail(target.email))
          notificationError('notification_invalid_recipient');
        resolved.push(target.email.trim().toLowerCase());
      } else {
        notificationError('notification_invalid_recipient');
      }
    }
    const unique = [...new Set(resolved)];
    if (unique.length > 20)
      notificationError('notification_too_many_recipients');
    return unique;
  }

  private async resolveContent(
    command: SubmitNotificationCommand,
    policy: Awaited<ReturnType<NotificationPolicyService['effective']>> | null,
  ): Promise<RenderedNotificationContent> {
    const source = command.content;
    if (source.kind === 'content') {
      if (policy && !policy.directContent)
        notificationError('notification_insufficient_capability');
      if (!source.subject?.trim() || !source.text?.trim())
        notificationError('notification_invalid_variables');
      return this.validateRenderedContent({
        subject: source.subject,
        text: source.text,
        html: source.html ? this.renderer.sanitize(source.html) : undefined,
      });
    }
    if (
      source.kind !== 'template' ||
      typeof source.templateKey !== 'string' ||
      !source.templateKey.trim() ||
      source.templateKey.length > 100 ||
      !source.variables ||
      typeof source.variables !== 'object' ||
      Array.isArray(source.variables)
    )
      notificationError('notification_invalid_variables');
    const template = await this.templateRepo.findOneBy({
      key: source.templateKey,
    });
    if (!template) notificationError('notification_template_missing');
    if (!template.enabled) notificationError('notification_template_disabled');
    if (policy && !policy.templateIds.has(template.id))
      notificationError('notification_template_forbidden');
    return this.validateRenderedContent(
      this.renderer.render(template, source.variables),
    );
  }

  private validateCommand(command: SubmitNotificationCommand) {
    if (
      !command?.caller ||
      !['internal', 'subapp'].includes(command.caller.kind) ||
      !Array.isArray(command.recipients) ||
      !command.content ||
      (command.idempotencyKey !== undefined &&
        (typeof command.idempotencyKey !== 'string' ||
          command.idempotencyKey.length < 1 ||
          command.idempotencyKey.length > 191))
    ) {
      notificationError('notification_invalid_variables');
    }
    if (
      (command.caller.kind === 'internal' &&
        (typeof command.caller.name !== 'string' ||
          !command.caller.name ||
          command.caller.name.length > 100)) ||
      (command.caller.kind === 'subapp' &&
        (typeof command.caller.appId !== 'string' || !command.caller.appId))
    ) {
      notificationError('notification_invalid_variables');
    }
  }

  private validateRenderedContent(
    content: RenderedNotificationContent,
  ): RenderedNotificationContent {
    if (
      typeof content.subject !== 'string' ||
      !content.subject.trim() ||
      content.subject.length > 255 ||
      typeof content.text !== 'string' ||
      !content.text.trim() ||
      Buffer.byteLength(content.text, 'utf8') > 102400 ||
      (content.html !== undefined &&
        (typeof content.html !== 'string' ||
          Buffer.byteLength(content.html, 'utf8') > 204800))
    ) {
      notificationError('notification_invalid_variables');
    }
    return content;
  }

  private hash(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private recipientDigest(value: string) {
    const secret = this.config.get<string>('NOTIFICATION_API_KEY_SECRET');
    if (!secret) throw new Error('NOTIFICATION_API_KEY_SECRET is required');
    return createHmac('sha256', secret).update(value).digest('hex');
  }
}
