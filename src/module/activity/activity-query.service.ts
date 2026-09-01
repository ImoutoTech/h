import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  PERMISSION_SERVICE_TOKEN,
  PermissionService,
  BusinessException,
} from '@reus-able/nestjs';
import { UserRole, type UserJwtPayload } from '@reus-able/types';
import {
  MoreThanOrEqual,
  type FindOptionsWhere,
  type Repository,
} from 'typeorm';
import {
  AppStatus,
  ExternalIdentity,
  SubApp,
  User,
  UserActivityEvent,
} from '@/entity';
import type { ActivityQueryDto } from '@/dto';
import type {
  ActivityCategory,
  UserActivityProjection,
} from './activity.types';

const APP_VIEW_PERMISSION = 'PeqSazMt';
const OVERVIEW_WINDOW_DAYS = 30;

@Injectable()
export class ActivityQueryService {
  @InjectRepository(User) private readonly users: Repository<User>;
  @InjectRepository(ExternalIdentity)
  private readonly identities: Repository<ExternalIdentity>;
  @InjectRepository(SubApp) private readonly apps: Repository<SubApp>;
  @InjectRepository(UserActivityEvent)
  private readonly events: Repository<UserActivityEvent>;
  @Inject(PERMISSION_SERVICE_TOKEN)
  private readonly permissions: PermissionService;

  async overview(principal: UserJwtPayload) {
    const [user, identities] = await Promise.all([
      this.users.findOne({
        where: { id: principal.id },
        relations: { roles: true },
      }),
      this.identities.find({
        where: { user: { id: principal.id } },
        order: { createdAt: 'ASC' },
      }),
    ]);
    if (!user) throw new BusinessException('用户不存在');

    const canViewApps = await this.canViewApps(principal, user);
    return {
      windowDays: OVERVIEW_WINDOW_DAYS,
      account: {
        email: user.email,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
        emailVerified: Boolean(user.emailVerifiedAt),
        hasPassword: Boolean(user.password),
        identities: identities.map((identity) => ({
          id: identity.id,
          provider: identity.provider,
          email: identity.email,
          displayName: identity.displayName,
          avatarUrl: identity.avatarUrl,
          createdAt: identity.createdAt,
        })),
      },
      apps: canViewApps ? await this.appOverview(principal.id) : null,
    };
  }

  async activity(userId: number, query: ActivityQueryDto) {
    const where: FindOptionsWhere<UserActivityEvent> = {
      actorUserId: userId,
      ...(query.category ? { category: query.category } : {}),
    };
    const [events, count] = await this.events.findAndCount({
      where,
      order: { occurredAt: 'DESC', id: 'DESC' },
      skip: (query.page - 1) * query.size,
      take: query.size,
    });
    return {
      items: events.map((event) => this.project(event)),
      count,
      total: count,
      page: query.page,
      size: query.size,
      hasMore: query.page * query.size < count,
    };
  }

  private async canViewApps(principal: UserJwtPayload, user: User) {
    if (principal.role === UserRole.ADMIN || user.role === UserRole.ADMIN)
      return true;
    const roleIds = (user.roles || []).map((role) => String(role.id));
    const permissions = await this.permissions.getPermissionByRoles(roleIds);
    return permissions.includes(APP_VIEW_PERMISSION);
  }

  private async appOverview(ownerUserId: number) {
    const since = new Date(
      Date.now() - OVERVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000,
    );
    const [apps, loginSucceeded, consentApproved, consentDenied] =
      await Promise.all([
        this.apps.find({
          where: { owner: { id: ownerUserId } },
          relations: { meta: true },
        }),
        this.metricCount(ownerUserId, 'login_succeeded', 'success', since),
        this.metricCount(ownerUserId, 'consent_decided', 'approved', since),
        this.metricCount(ownerUserId, 'consent_decided', 'denied', since),
      ]);
    return {
      total: apps.length,
      running: apps.filter((app) => app.meta?.status === AppStatus.RUNNING)
        .length,
      closed: apps.filter((app) => app.meta?.status === AppStatus.CLOSED)
        .length,
      banned: apps.filter((app) => app.meta?.status === AppStatus.BANNED)
        .length,
      loginSucceeded,
      consentApproved,
      consentDenied,
    };
  }

  private metricCount(
    ownerUserId: number,
    action: 'login_succeeded' | 'consent_decided',
    outcome: 'success' | 'approved' | 'denied',
    since: Date,
  ) {
    return this.events.count({
      where: {
        ownerUserId,
        category: 'oidc',
        action,
        outcome,
        occurredAt: MoreThanOrEqual(since),
      },
    });
  }

  private project(event: UserActivityEvent): UserActivityProjection {
    const projection: UserActivityProjection = {
      id: event.id,
      category: event.category as ActivityCategory,
      action: event.action,
      outcome: event.outcome,
      summary: this.summary(event),
      occurredAt: event.occurredAt,
    };
    const detail = this.detail(event);
    if (detail) projection.detail = detail;
    if (event.appId || event.category === 'subapp') {
      projection.target = {
        type: 'subapp',
        ...(event.appId ? { id: event.appId } : {}),
        name: event.targetName || '已删除的子应用',
      };
    } else if (event.category === 'identity' && event.targetName) {
      projection.target = {
        type: 'identity',
        name: event.targetName,
      };
    }
    return projection;
  }

  private summary(event: UserActivityEvent) {
    const key = `${event.category}.${event.action}.${event.outcome}`;
    const summaries: Record<string, string> = {
      'account.login_succeeded.success': '密码登录成功',
      'account.login_failed.failure': '密码登录失败',
      'account.profile_updated.success': '更新了个人资料',
      'account.email_changed.success': '更换了登录邮箱',
      'account.password_changed.success': '修改了登录密码',
      'identity.login_succeeded.success': '外部账号登录成功',
      'identity.identity_bound.success': '绑定了外部登录方式',
      'identity.identity_unbound.success': '解绑了外部登录方式',
      'oidc.consent_decided.approved': '同意了子应用授权',
      'oidc.consent_decided.denied': '拒绝了子应用授权',
      'oidc.login_succeeded.success': '完成了子应用登录',
      'subapp.created.success': '创建了子应用',
      'subapp.updated.success': '更新了子应用',
      'subapp.status_changed.success': '调整了子应用状态',
      'subapp.deleted.success': '删除了子应用',
      'subapp.secret_created.success': '创建了 Client Secret',
      'subapp.secret_status_changed.success': '调整了 Client Secret 状态',
      'subapp.secret_deleted.success': '删除了 Client Secret',
    };
    return summaries[key] || '账号发生了一项活动';
  }

  private detail(event: UserActivityEvent) {
    if (event.category === 'account' && event.action === 'profile_updated') {
      const labels: Record<string, string> = {
        avatar: '头像',
        nickname: '昵称',
      };
      const fields = event.metadata?.changedFields
        ?.map((field) => labels[field])
        .filter(Boolean);
      return fields?.length ? `变更内容：${fields.join('、')}` : undefined;
    }
    if (event.category === 'identity') {
      const provider = event.metadata?.provider || event.metadata?.method;
      return provider ? `登录方式：${provider}` : undefined;
    }
    if (event.category === 'oidc' && event.metadata?.scopes?.length) {
      return `授权范围：${event.metadata.scopes.join('、')}`;
    }
    return undefined;
  }
}
