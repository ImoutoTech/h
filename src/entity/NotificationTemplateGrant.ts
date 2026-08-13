import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { SubApp } from './SubApp';
import { NotificationTemplate } from './NotificationTemplate';

@Entity({ name: 'notification_template_grants' })
@Unique('uq_notification_template_grant', ['app', 'template'])
export class NotificationTemplateGrant {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SubApp, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'app_id' })
  app: SubApp;

  @ManyToOne(() => NotificationTemplate, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'template_id' })
  template: NotificationTemplate;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
