import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SubApp } from './SubApp';
import { User } from './User';

@Entity({ name: 'notification_api_keys' })
export class NotificationApiKey {
  @PrimaryColumn({ type: 'char', length: 36 })
  id: string;

  @ManyToOne(() => SubApp, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'app_id' })
  app: SubApp;

  @Column({ type: 'char', length: 64 })
  digest: string;

  @Column({ type: 'varchar', length: 32 })
  hint: string;

  @Column({ default: true })
  enabled: boolean;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @Column({ name: 'last_used_at', type: 'datetime', nullable: true })
  lastUsedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
