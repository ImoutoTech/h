import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Notification } from './Notification';

export type NotificationDeliveryStatus =
  | 'pending'
  | 'processing'
  | 'sent'
  | 'failed';

@Entity({ name: 'notification_deliveries' })
@Index('idx_notification_delivery_claim', [
  'status',
  'nextAttemptAt',
  'leaseExpiresAt',
])
export class NotificationDelivery {
  @PrimaryColumn({ type: 'char', length: 36 })
  id: string;

  @ManyToOne(() => Notification, (notification) => notification.deliveries, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'notification_id' })
  notification: Notification;

  @Column({ name: 'recipient_ciphertext', type: 'text', nullable: true })
  recipientCiphertext: string;

  @Column({ name: 'recipient_iv', type: 'varchar', length: 64, nullable: true })
  recipientIv: string;

  @Column({
    name: 'recipient_tag',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  recipientTag: string;

  @Column({ name: 'recipient_digest', type: 'char', length: 64 })
  recipientDigest: string;

  @Column({ name: 'key_version', type: 'varchar', length: 32, nullable: true })
  keyVersion: string;

  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: NotificationDeliveryStatus;

  @Column({ type: 'tinyint', unsigned: true, default: 0 })
  attempts: number;

  @Column({ name: 'next_attempt_at', type: 'datetime', nullable: true })
  nextAttemptAt: Date;

  @Column({ name: 'lease_owner', type: 'varchar', length: 100, nullable: true })
  leaseOwner: string;

  @Column({ name: 'lease_expires_at', type: 'datetime', nullable: true })
  leaseExpiresAt: Date;

  @Column({ name: 'error_class', type: 'varchar', length: 50, nullable: true })
  errorClass: string;

  @Column({ name: 'sent_at', type: 'datetime', nullable: true })
  sentAt: Date;

  @Column({ name: 'payload_purged_at', type: 'datetime', nullable: true })
  payloadPurgedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
