import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './User';

@Entity({ name: 'notification_templates' })
export class NotificationTemplate {
  @PrimaryColumn({ type: 'char', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  key: string;

  @Column({ type: 'varchar', length: 191 })
  name: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ type: 'mediumtext' })
  text: string;

  @Column({ type: 'mediumtext', nullable: true })
  html: string;

  @Column({ name: 'allowed_variables', type: 'json' })
  allowedVariables: string[];

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by' })
  updatedBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
