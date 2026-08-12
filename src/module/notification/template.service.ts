import { randomUUID } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { BusinessException, HLOGGER_TOKEN, HLogger } from '@reus-able/nestjs';
import type { Repository } from 'typeorm';
import { NotificationTemplate, User } from '@/entity';
import type {
  CreateNotificationTemplateDto,
  UpdateNotificationTemplateDto,
} from '@/dto';
import { TemplateRenderer } from './template-renderer';

@Injectable()
export class NotificationTemplateService {
  @InjectRepository(NotificationTemplate)
  private repo: Repository<NotificationTemplate>;
  @InjectRepository(User) private userRepo: Repository<User>;
  @Inject(HLOGGER_TOKEN) private logger: HLogger;

  constructor(private readonly renderer: TemplateRenderer) {}

  projection(item: NotificationTemplate) {
    return {
      id: item.id,
      key: item.key,
      name: item.name,
      enabled: item.enabled,
      subject: item.subject,
      text: item.text,
      html: item.html || null,
      allowedVariables: item.allowedVariables || [],
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  async list() {
    return (await this.repo.find({ order: { key: 'ASC' } })).map((item) =>
      this.projection(item),
    );
  }

  async options() {
    const items = await this.repo.find({
      select: { id: true, key: true, name: true, enabled: true },
      order: { key: 'ASC' },
    });
    return items.map(({ id, key, name, enabled }) => ({
      id,
      key,
      name,
      enabled,
    }));
  }

  async get(id: string) {
    const item = await this.repo.findOneBy({ id });
    if (!item) throw new BusinessException('消息模板不存在');
    return this.projection(item);
  }

  async create(body: CreateNotificationTemplateDto, actorId: number) {
    if (!body.name.trim()) throw new BusinessException('消息模板名称不能为空');
    if (await this.repo.exist({ where: { key: body.key } }))
      throw new BusinessException('消息模板 key 已存在');
    this.renderer.validate(
      body.subject,
      body.text,
      body.html,
      body.allowedVariables,
    );
    const item = this.repo.create({
      ...body,
      id: randomUUID(),
      name: body.name.trim(),
      html: body.html?.trim() || null,
      enabled: body.enabled ?? true,
      updatedBy: await this.userRepo.findOneBy({ id: actorId }),
    });
    await this.repo.save(item);
    this.audit(actorId, item.id, 'create');
    return this.projection(item);
  }

  async update(
    id: string,
    body: UpdateNotificationTemplateDto,
    actorId: number,
  ) {
    const item = await this.repo.findOneBy({ id });
    if (!item) throw new BusinessException('消息模板不存在');
    if (body.name !== undefined && !body.name.trim())
      throw new BusinessException('消息模板名称不能为空');
    for (const field of [
      'name',
      'subject',
      'text',
      'allowedVariables',
    ] as const) {
      if (body[field] !== undefined) (item as any)[field] = body[field];
    }
    if (body.name !== undefined) item.name = body.name.trim();
    if (body.html !== undefined) item.html = body.html.trim() || null;
    this.renderer.validate(
      item.subject,
      item.text,
      item.html,
      item.allowedVariables,
    );
    item.updatedBy = await this.userRepo.findOneBy({ id: actorId });
    await this.repo.save(item);
    this.audit(actorId, item.id, 'update');
    return this.projection(item);
  }

  async setEnabled(id: string, enabled: boolean, actorId: number) {
    const item = await this.repo.findOneBy({ id });
    if (!item) throw new BusinessException('消息模板不存在');
    item.enabled = enabled;
    item.updatedBy = await this.userRepo.findOneBy({ id: actorId });
    await this.repo.save(item);
    this.audit(actorId, item.id, enabled ? 'enable' : 'disable');
    return this.projection(item);
  }

  private audit(actorId: number, id: string, action: string) {
    this.logger.log(
      `消息模板审计 actor=${actorId} template=${id} action=${action} outcome=success`,
      NotificationTemplateService.name,
    );
  }
}
