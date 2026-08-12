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

export type NotificationTlsMode = 'none' | 'starttls' | 'tls';

@Entity({ name: 'notification_channel_configs' })
export class NotificationChannelConfig {
  @PrimaryColumn({ name: 'channel_type', type: 'varchar', length: 20 })
  channelType: 'email';

  @Column({ default: false })
  enabled: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  host: string;

  @Column({ type: 'smallint', unsigned: true, nullable: true })
  port: number;

  @Column({
    name: 'tls_mode',
    type: 'varchar',
    length: 20,
    default: 'starttls',
  })
  tlsMode: NotificationTlsMode;

  @Column({ type: 'varchar', length: 255, nullable: true })
  username: string;

  @Column({ name: 'password_ciphertext', type: 'text', nullable: true })
  passwordCiphertext: string;

  @Column({ name: 'password_iv', type: 'varchar', length: 64, nullable: true })
  passwordIv: string;

  @Column({ name: 'password_tag', type: 'varchar', length: 64, nullable: true })
  passwordTag: string;

  @Column({
    name: 'password_hint',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  passwordHint: string;

  @Column({ name: 'key_version', type: 'varchar', length: 32, nullable: true })
  keyVersion: string;

  @Column({ name: 'from_name', type: 'varchar', length: 191, nullable: true })
  fromName: string;

  @Column({
    name: 'from_address',
    type: 'varchar',
    length: 320,
    nullable: true,
  })
  fromAddress: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by' })
  updatedBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
