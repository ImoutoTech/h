import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BusinessException, HLOGGER_TOKEN, HLogger } from '@reus-able/nestjs';
import { In, type Repository } from 'typeorm';
import {
  NotificationTemplate,
  NotificationTemplateGrant,
  SubApp,
  SubAppNotificationPolicy,
  User,
} from '@/entity';
import type { UpdateNotificationPolicyDto } from '@/dto';

@Injectable()
export class NotificationPolicyService {
  @InjectRepository(SubAppNotificationPolicy)
  private policyRepo: Repository<SubAppNotificationPolicy>;
  @InjectRepository(NotificationTemplateGrant)
  private grantRepo: Repository<NotificationTemplateGrant>;
  @InjectRepository(NotificationTemplate)
  private templateRepo: Repository<NotificationTemplate>;
  @InjectRepository(SubApp) private appRepo: Repository<SubApp>;
  @InjectRepository(User) private userRepo: Repository<User>;
  @Inject(HLOGGER_TOKEN) private logger: HLogger;

  async listApps() {
    const apps = await this.appRepo.find({
      select: { id: true, name: true },
      order: { name: 'ASC', id: 'ASC' },
    });
    return apps.map(({ id, name }) => ({ id, name }));
  }

  async get(appId: string) {
    if (!(await this.appRepo.exist({ where: { id: appId } })))
      throw new BusinessException('子应用不存在');
    const [policy, grants] = await Promise.all([
      this.policyRepo.findOneBy({ appId }),
      this.grantRepo.find({
        where: { app: { id: appId } },
        relations: { template: true },
      }),
    ]);
    return {
      appId,
      directContent: policy?.directContent || false,
      manualRecipient: policy?.manualRecipient || false,
      templateIds: grants.map((grant) => grant.template.id),
      updatedAt: policy?.updatedAt || null,
    };
  }

  async update(
    appId: string,
    body: UpdateNotificationPolicyDto,
    actorId: number,
  ) {
    const app = await this.appRepo.findOneBy({ id: appId });
    if (!app) throw new BusinessException('子应用不存在');
    const templates = body.templateIds.length
      ? await this.templateRepo.findBy({ id: In(body.templateIds) })
      : [];
    if (templates.length !== body.templateIds.length)
      throw new BusinessException('应用通知策略包含不存在的模板');
    const projection = await this.policyRepo.manager.transaction(
      async (manager) => {
        const policies = manager.getRepository(SubAppNotificationPolicy);
        const grants = manager.getRepository(NotificationTemplateGrant);
        let policy = await policies.findOneBy({ appId });
        if (!policy) policy = policies.create({ appId, app });
        policy.directContent = body.directContent;
        policy.manualRecipient = body.manualRecipient;
        policy.updatedBy = await this.userRepo.findOneBy({ id: actorId });
        await policies.save(policy);
        await grants.delete({ app: { id: appId } });
        if (templates.length) {
          await grants.save(
            templates.map((template) => grants.create({ app, template })),
          );
        }
        return {
          appId,
          directContent: policy.directContent,
          manualRecipient: policy.manualRecipient,
          templateIds: templates.map((item) => item.id),
          updatedAt: policy.updatedAt,
        };
      },
    );
    this.logger.log(
      `应用通知策略审计 actor=${actorId} app=${appId} action=update outcome=success`,
      NotificationPolicyService.name,
    );
    return projection;
  }

  async effective(appId: string) {
    const projection = await this.get(appId);
    return {
      ...projection,
      templateIds: new Set(projection.templateIds),
    };
  }
}
