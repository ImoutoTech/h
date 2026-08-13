import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { NotificationDelivery } from './NotificationDelivery';

export type NotificationStatus =
  | 'pending'
  | 'processing'
  | 'sent'
  | 'partial_failed'
  | 'failed';

@Entity({ name: 'notifications' })
@Index('uq_notification_idempotency', ['callerKey', 'idempotencyKey'], {
  unique: true,
})
export class Notification {
  @PrimaryColumn({ type: 'char', length: 36 })
  id: string;

  @Column({ name: 'caller_kind', type: 'varchar', length: 20 })
  callerKind: 'internal' | 'subapp';

  @Column({ name: 'caller_key', type: 'varchar', length: 150 })
  callerKey: string;

  @Column({ name: 'app_id', type: 'varchar', length: 36, nullable: true })
  appId: string;

  @Column({
    name: 'internal_name',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  internalName: string;

  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 191,
    nullable: true,
  })
  idempotencyKey: string;

  @Column({ name: 'request_hash', type: 'char', length: 64 })
  requestHash: string;

  @Column({
    name: 'channel_type',
    type: 'varchar',
    length: 20,
    default: 'email',
  })
  channelType: 'email';

  @Column({ name: 'subject_ciphertext', type: 'mediumtext', nullable: true })
  subjectCiphertext: string;

  @Column({ name: 'subject_iv', type: 'varchar', length: 64, nullable: true })
  subjectIv: string;

  @Column({ name: 'subject_tag', type: 'varchar', length: 64, nullable: true })
  subjectTag: string;

  @Column({ name: 'text_ciphertext', type: 'mediumtext', nullable: true })
  textCiphertext: string;

  @Column({ name: 'text_iv', type: 'varchar', length: 64, nullable: true })
  textIv: string;

  @Column({ name: 'text_tag', type: 'varchar', length: 64, nullable: true })
  textTag: string;

  @Column({ name: 'html_ciphertext', type: 'mediumtext', nullable: true })
  htmlCiphertext: string;

  @Column({ name: 'html_iv', type: 'varchar', length: 64, nullable: true })
  htmlIv: string;

  @Column({ name: 'html_tag', type: 'varchar', length: 64, nullable: true })
  htmlTag: string;

  @Column({ name: 'key_version', type: 'varchar', length: 32, nullable: true })
  keyVersion: string;

  @Column({ type: 'varchar', length: 30, default: 'pending' })
  status: NotificationStatus;

  @Column({ name: 'total_count', type: 'smallint', unsigned: true })
  totalCount: number;

  @Column({ name: 'sent_count', type: 'smallint', unsigned: true, default: 0 })
  sentCount: number;

  @Column({
    name: 'failed_count',
    type: 'smallint',
    unsigned: true,
    default: 0,
  })
  failedCount: number;

  @Column({ name: 'payload_purged_at', type: 'datetime', nullable: true })
  payloadPurgedAt: Date;

  @OneToMany(() => NotificationDelivery, (delivery) => delivery.notification)
  deliveries: NotificationDelivery[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
