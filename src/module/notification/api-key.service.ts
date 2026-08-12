import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { BusinessException, HLOGGER_TOKEN, HLogger } from '@reus-able/nestjs';
import type { Repository } from 'typeorm';
import { NotificationApiKey, SubApp, User } from '@/entity';
import { notificationError } from './notification-error';

@Injectable()
export class NotificationApiKeyService {
  @InjectRepository(NotificationApiKey)
  private repo: Repository<NotificationApiKey>;
  @InjectRepository(SubApp) private appRepo: Repository<SubApp>;
  @InjectRepository(User) private userRepo: Repository<User>;
  @Inject(HLOGGER_TOKEN) private logger: HLogger;

  constructor(private readonly config: ConfigService) {}

  private hmac(value: string) {
    const secret = this.config.get<string>('NOTIFICATION_API_KEY_SECRET');
    if (!secret) throw new Error('NOTIFICATION_API_KEY_SECRET is required');
    return createHmac('sha256', secret).update(value).digest('hex');
  }

  private projection(item: NotificationApiKey) {
    return {
      id: item.id,
      hint: item.hint,
      enabled: item.enabled,
      lastUsedAt: item.lastUsedAt || null,
      createdAt: item.createdAt,
    };
  }

  private async ownerApp(appId: string, ownerId: number) {
    const app = await this.appRepo.findOne({
      where: { id: appId },
      relations: { owner: true },
    });
    if (!app || app.owner?.id !== ownerId) BusinessException.throwForbidden();
    return app;
  }

  async list(appId: string, ownerId: number) {
    await this.ownerApp(appId, ownerId);
    return (
      await this.repo.find({
        where: { app: { id: appId } },
        order: { createdAt: 'DESC' },
      })
    ).map((item) => this.projection(item));
  }

  async create(appId: string, ownerId: number) {
    const app = await this.ownerApp(appId, ownerId);
    const id = randomUUID();
    const plaintext = `hnt_${id}_${randomBytes(32).toString('base64url')}`;
    const item = this.repo.create({
      id,
      app,
      digest: this.hmac(plaintext),
      hint: `hnt_…${plaintext.slice(-6)}`,
      enabled: true,
      createdBy: await this.userRepo.findOneBy({ id: ownerId }),
    });
    await this.repo.save(item);
    this.audit(ownerId, appId, id, 'create');
    return { ...this.projection(item), value: plaintext };
  }

  async setEnabled(
    appId: string,
    keyId: string,
    enabled: boolean,
    ownerId: number,
  ) {
    await this.ownerApp(appId, ownerId);
    const item = await this.repo.findOne({
      where: { id: keyId, app: { id: appId } },
      relations: { app: true },
    });
    if (!item) BusinessException.throwForbidden();
    item.enabled = enabled;
    await this.repo.save(item);
    this.audit(ownerId, appId, keyId, enabled ? 'enable' : 'disable');
    return this.projection(item);
  }

  async remove(appId: string, keyId: string, ownerId: number) {
    await this.ownerApp(appId, ownerId);
    const result = await this.repo.delete({ id: keyId, app: { id: appId } });
    if (!result.affected) BusinessException.throwForbidden();
    this.audit(ownerId, appId, keyId, 'delete');
    return true;
  }

  async authenticate(value: string) {
    const match = /^hnt_([0-9a-f-]{36})_[A-Za-z0-9_-]+$/.exec(value || '');
    if (!match) notificationError('notification_invalid_key');
    const item = await this.repo.findOne({
      where: { id: match[1] },
      relations: { app: true },
    });
    if (!item) notificationError('notification_invalid_key');
    const expected = Buffer.from(item.digest, 'hex');
    const actual = Buffer.from(this.hmac(value), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
      notificationError('notification_invalid_key');
    if (!item.enabled) notificationError('notification_disabled_key');
    // Do not save the previously loaded entity: a concurrent disable must not
    // be overwritten by a stale `enabled = true` value.
    const touched = await this.repo.update(
      { id: item.id, enabled: true },
      { lastUsedAt: new Date() },
    );
    if (touched.affected !== 1) notificationError('notification_disabled_key');
    return { kind: 'subapp' as const, appId: item.app.id };
  }

  private audit(actorId: number, appId: string, keyId: string, action: string) {
    this.logger.log(
      `通知密钥审计 actor=${actorId} app=${appId} key=${keyId} action=${action} outcome=success`,
      NotificationApiKeyService.name,
    );
  }
}
