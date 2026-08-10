import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export const EMAIL_VERIFICATION_PURPOSES = [
  'register',
  'change_email',
] as const;
export type EmailVerificationPurpose =
  (typeof EMAIL_VERIFICATION_PURPOSES)[number];

@Entity({ name: 'email_verification_challenges' })
@Index('idx_email_challenge_target', [
  'purpose',
  'normalizedEmail',
  'createdAt',
])
@Index('idx_email_challenge_user_purpose', ['userId', 'purpose', 'createdAt'])
@Index('uq_email_challenge_active_key', ['activeKey'], { unique: true })
export class EmailVerificationChallenge {
  @PrimaryColumn({ type: 'char', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 20 })
  purpose: EmailVerificationPurpose;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number;

  @Column({ name: 'normalized_email', type: 'varchar', length: 320 })
  normalizedEmail: string;

  @Column({ name: 'active_key', type: 'char', length: 64, nullable: true })
  activeKey: string;

  @Column({ name: 'code_hash', type: 'char', length: 64 })
  codeHash: string;

  @Column({ name: 'expires_at', type: 'datetime', precision: 6 })
  expiresAt: Date;

  @Column({
    name: 'failed_attempts',
    type: 'smallint',
    unsigned: true,
    default: 0,
  })
  failedAttempts: number;

  @Column({ name: 'max_attempts', type: 'smallint', unsigned: true })
  maxAttempts: number;

  @Column({ name: 'resend_available_at', type: 'datetime', precision: 6 })
  resendAvailableAt: Date;

  @Column({
    name: 'verified_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  verifiedAt: Date;

  @Column({
    name: 'consumed_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  consumedAt: Date;

  @Column({
    name: 'invalidated_at',
    type: 'datetime',
    precision: 6,
    nullable: true,
  })
  invalidatedAt: Date;

  @Column({
    name: 'notification_id',
    type: 'varchar',
    length: 191,
    nullable: true,
  })
  notificationId: string;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'datetime', precision: 6 })
  updatedAt: Date;
}
