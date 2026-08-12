import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BusinessException, HLOGGER_TOKEN, HLogger } from '@reus-able/nestjs';
import type { Repository } from 'typeorm';
import { NotificationChannelConfig, User } from '@/entity';
import type { UpdateNotificationChannelDto } from '@/dto';
import { NotificationEnvelopeService } from './notification-envelope';

@Injectable()
export class ChannelConfigService {
  @InjectRepository(NotificationChannelConfig)
  private repo: Repository<NotificationChannelConfig>;
  @InjectRepository(User) private userRepo: Repository<User>;
  @Inject(HLOGGER_TOKEN) private logger: HLogger;

  constructor(private readonly envelopes: NotificationEnvelopeService) {}

  private projection(item?: NotificationChannelConfig) {
    return {
      channelType: 'email' as const,
      enabled: item?.enabled || false,
      host: item?.host || null,
      port: item?.port || null,
      tlsMode: item?.tlsMode || 'starttls',
      username: item?.username || null,
      fromName: item?.fromName || null,
      fromAddress: item?.fromAddress || null,
      passwordConfigured: Boolean(item?.passwordCiphertext),
      passwordHint: item?.passwordHint || null,
      updatedAt: item?.updatedAt || null,
    };
  }

  async get() {
    return this.projection(await this.repo.findOneBy({ channelType: 'email' }));
  }

  async update(body: UpdateNotificationChannelDto, actorId: number) {
    let item = await this.repo.findOneBy({ channelType: 'email' });
    if (!item)
      item = this.repo.create({ channelType: 'email', enabled: false });
    for (const field of [
      'host',
      'tlsMode',
      'username',
      'fromName',
      'fromAddress',
    ] as const) {
      if (body[field] !== undefined) {
        const value = body[field];
        (item as any)[field] =
          typeof value === 'string' ? value.trim() || null : value;
      }
    }
    if (body.port !== undefined) item.port = body.port;
    if (body.password?.trim()) {
      const envelope = this.envelopes.encrypt(
        body.password,
        'notification-channel:email',
      );
      item.passwordCiphertext = envelope.ciphertext;
      item.passwordIv = envelope.iv;
      item.passwordTag = envelope.tag;
      item.keyVersion = envelope.keyVersion;
      item.passwordHint = this.envelopes.hint(body.password);
    }
    const enable = body.enabled === undefined ? item.enabled : body.enabled;
    if (
      enable &&
      (!item.host?.trim() ||
        !item.port ||
        !item.username?.trim() ||
        !item.passwordCiphertext ||
        !item.fromAddress?.trim())
    ) {
      throw new BusinessException('启用 SMTP 前必须完成全部必填配置');
    }
    item.enabled = enable;
    item.updatedBy = await this.userRepo.findOneBy({ id: actorId });
    await this.repo.save(item);
    this.logger.log(
      `通知渠道配置审计 actor=${actorId} channel=email action=update outcome=success`,
      ChannelConfigService.name,
    );
    return this.projection(item);
  }

  async credentials() {
    const item = await this.repo.findOneBy({ channelType: 'email' });
    if (
      !item?.enabled ||
      !item.host ||
      !item.port ||
      !item.username ||
      !item.passwordCiphertext ||
      !item.fromAddress
    ) {
      return null;
    }
    return {
      host: item.host,
      port: item.port,
      tlsMode: item.tlsMode,
      username: item.username,
      password: this.envelopes.decrypt(
        {
          ciphertext: item.passwordCiphertext,
          iv: item.passwordIv,
          tag: item.passwordTag,
          keyVersion: item.keyVersion,
        },
        'notification-channel:email',
      ),
      fromName: item.fromName,
      fromAddress: item.fromAddress,
    };
  }
}
