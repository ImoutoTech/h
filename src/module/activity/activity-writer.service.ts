import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { HLOGGER_TOKEN, HLogger } from '@reus-able/nestjs';
import type { Repository } from 'typeorm';
import { SubApp, UserActivityEvent } from '@/entity';
import type { ActivityCommand, ActivityMetadata } from './activity.types';

@Injectable()
export class ActivityWriterService {
  @InjectRepository(UserActivityEvent)
  private readonly events: Repository<UserActivityEvent>;

  @InjectRepository(SubApp)
  private readonly apps: Repository<SubApp>;

  @Inject(HLOGGER_TOKEN)
  private readonly logger: HLogger;

  async record(command: ActivityCommand): Promise<void> {
    try {
      const event = await this.toEvent(command);
      await this.events.insert(event);
    } catch (reason) {
      if (this.isDuplicate(reason)) return;
      this.logger.warn(
        '用户活动事件写入失败，主业务结果不受影响',
        ActivityWriterService.name,
      );
    }
  }

  private async toEvent(command: ActivityCommand) {
    const base: Partial<UserActivityEvent> = {
      actorUserId: command.actorUserId ?? null,
      ownerUserId: null,
      appId: null,
      targetName: null,
      metadata: null,
      dedupeKey: null,
    };

    if (command.kind === 'account.login') {
      return this.events.create({
        ...base,
        category: command.method === 'password' ? 'account' : 'identity',
        action:
          command.outcome === 'success' ? 'login_succeeded' : 'login_failed',
        outcome: command.outcome,
        metadata: { method: command.method },
      });
    }

    if (command.kind === 'account.changed') {
      const metadata: ActivityMetadata | null = command.changedFields?.length
        ? { changedFields: [...new Set(command.changedFields)] }
        : null;
      return this.events.create({
        ...base,
        category: 'account',
        action: command.action,
        outcome: 'success',
        metadata,
      });
    }

    if (command.kind === 'identity.changed') {
      return this.events.create({
        ...base,
        category: 'identity',
        action: command.action,
        outcome: 'success',
        targetName: command.provider,
        metadata: { provider: command.provider },
      });
    }

    if (command.kind === 'subapp.changed') {
      return this.events.create({
        ...base,
        actorUserId: command.actorUserId,
        ownerUserId: command.actorUserId,
        appId: command.appId,
        targetName: command.appName.slice(0, 191),
        category: 'subapp',
        action: command.action,
        outcome: 'success',
        metadata:
          command.status === undefined && command.secretEnabled === undefined
            ? null
            : {
                ...(command.status === undefined
                  ? {}
                  : { status: command.status }),
                ...(command.secretEnabled === undefined
                  ? {}
                  : { secretEnabled: command.secretEnabled }),
              },
      });
    }

    const app = await this.apps.findOne({
      select: { id: true, name: true, owner: { id: true } },
      where: { id: command.appId },
      relations: { owner: true },
    });
    const scopes = this.safeScopes(command.scopes);
    const dedupeSource =
      command.kind === 'oidc.login'
        ? `oidc.login:${command.authorizationCodeJti}`
        : `oidc.consent:${command.dedupeSource}`;
    return this.events.create({
      ...base,
      actorUserId: command.actorUserId,
      ownerUserId: app?.owner?.id ?? null,
      appId: command.appId,
      targetName: app?.name?.slice(0, 191) ?? null,
      category: 'oidc',
      action:
        command.kind === 'oidc.login' ? 'login_succeeded' : 'consent_decided',
      outcome: command.kind === 'oidc.login' ? 'success' : command.outcome,
      metadata: scopes.length ? { scopes } : null,
      dedupeKey: createHash('sha256').update(dedupeSource).digest('hex'),
    });
  }

  private safeScopes(scopes: string[]) {
    return [...new Set(scopes)]
      .filter((scope) => ['openid', 'profile', 'email'].includes(scope))
      .sort();
  }

  private isDuplicate(reason: any) {
    return (
      reason?.code === 'ER_DUP_ENTRY' ||
      reason?.driverError?.code === 'ER_DUP_ENTRY'
    );
  }
}
