import { ProviderConfig, User, type ExternalProvider } from '@/entity';
import { UpdateProviderConfigDto } from '@/dto';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { BusinessException, HLOGGER_TOKEN, HLogger } from '@reus-able/nestjs';
import type { Repository } from 'typeorm';
import {
  decryptSecret,
  encryptSecret,
  parseSecretKey,
} from './secret-envelope';

@Injectable()
export class ProviderConfigService {
  @InjectRepository(ProviderConfig) private repo: Repository<ProviderConfig>;
  @InjectRepository(User) private userRepo: Repository<User>;
  @Inject(HLOGGER_TOKEN) private logger: HLogger;

  constructor(private readonly config: ConfigService) {}

  private projection(item: ProviderConfig) {
    return {
      provider: item.provider,
      enabled: item.enabled,
      clientId: item.clientId,
      configured: Boolean(item.clientId && item.secretCiphertext),
      secretHint: item.secretHint,
      updatedAt: item.updatedAt,
    };
  }

  async list(enabledOnly = false) {
    const items = await this.repo.find({ order: { provider: 'ASC' } });
    return items
      .filter((item) => !enabledOnly || item.enabled)
      .map((item) => this.projection(item));
  }

  async update(
    provider: ExternalProvider,
    body: UpdateProviderConfigDto,
    actorId: number,
  ) {
    try {
      const result = await this.updateConfig(provider, body, actorId);
      this.logger.log(
        `外部登录配置审计 actor=${actorId} provider=${provider} action=update outcome=success`,
        ProviderConfigService.name,
      );
      return result;
    } catch (reason) {
      this.logger.warn(
        `外部登录配置审计 actor=${actorId} provider=${provider} action=update outcome=failure`,
        ProviderConfigService.name,
      );
      throw reason;
    }
  }

  private async updateConfig(
    provider: ExternalProvider,
    body: UpdateProviderConfigDto,
    actorId: number,
  ) {
    let item = await this.repo.findOneBy({ provider });
    if (!item) item = this.repo.create({ provider, enabled: false });
    if (body.clientId !== undefined)
      item.clientId = body.clientId.trim() || null;
    if (body.clientSecret) {
      const version = this.config.get<string>('PROVIDER_SECRET_KEY_VERSION');
      if (!version) throw new Error('PROVIDER_SECRET_KEY_VERSION is required');
      const envelope = encryptSecret(
        body.clientSecret,
        provider,
        parseSecretKey(
          this.config.get<string>('PROVIDER_SECRET_KEY'),
          'PROVIDER_SECRET_KEY',
        ),
        version,
      );
      item.secretCiphertext = envelope.ciphertext;
      item.secretIv = envelope.iv;
      item.secretTag = envelope.tag;
      item.secretHint = envelope.hint;
      item.keyVersion = envelope.keyVersion;
    }
    if (body.enabled === true && (!item.clientId || !item.secretCiphertext))
      throw new BusinessException('启用提供方前必须配置 client ID 和 secret');
    if (body.enabled !== undefined) item.enabled = body.enabled;
    item.updatedBy = await this.userRepo.findOneBy({ id: actorId });
    await this.repo.save(item);
    return this.projection(item);
  }

  async credentials(provider: ExternalProvider) {
    const item = await this.repo.findOneBy({ provider, enabled: true });
    if (!item) throw new BusinessException('外部登录提供方未启用');
    if (!item.clientId || !item.secretCiphertext)
      throw new BusinessException('外部登录提供方配置不完整');
    const clientSecret = decryptSecret(
      {
        ciphertext: item.secretCiphertext,
        iv: item.secretIv,
        tag: item.secretTag,
        hint: item.secretHint,
        keyVersion: item.keyVersion,
      },
      provider,
      parseSecretKey(
        this.config.get<string>('PROVIDER_SECRET_KEY'),
        'PROVIDER_SECRET_KEY',
      ),
    );
    return { clientId: item.clientId, clientSecret };
  }
}
