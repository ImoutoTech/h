import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SubApp } from './SubApp';
import { User } from './User';

@Entity({ name: 'subapp_notification_policies' })
export class SubAppNotificationPolicy {
  @PrimaryColumn({ name: 'app_id', type: 'varchar', length: 36 })
  appId: string;

  @OneToOne(() => SubApp, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'app_id' })
  app: SubApp;

  @Column({ name: 'direct_content', default: false })
  directContent: boolean;

  @Column({ name: 'manual_recipient', default: false })
  manualRecipient: boolean;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by' })
  updatedBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
