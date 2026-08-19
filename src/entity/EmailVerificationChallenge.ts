import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { EmailVerificationPurpose } from './email-verification-purpose';

@Entity({ name: 'email_verification_challenges' })
@Index('idx_email_challenge_subject', ['purpose', 'userId', 'email'])
@Index('idx_email_challenge_source', ['sourceHash', 'createdAt'])
@Index('uq_email_challenge_proof_hash', ['proofHash'], { unique: true })
export class EmailVerificationChallenge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: EmailVerificationPurpose })
  purpose: EmailVerificationPurpose;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  @Column({ type: 'varchar', length: 320 })
  email: string;

  @Column({ name: 'source_hash', type: 'varchar', length: 64 })
  sourceHash: string;

  @Column({ name: 'code_hash', type: 'varchar', length: 64 })
  codeHash: string;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt: Date;

  @Column({ name: 'resend_at', type: 'datetime' })
  resendAt: Date;

  @Column({ name: 'failed_attempts', type: 'int', default: 0 })
  failedAttempts: number;

  @Column({ name: 'max_attempts', type: 'int', default: 5 })
  maxAttempts: number;

  @Column({ name: 'verified_at', type: 'datetime', nullable: true })
  verifiedAt: Date | null;

  @Column({
    name: 'proof_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  proofHash: string | null;

  @Column({ name: 'proof_expires_at', type: 'datetime', nullable: true })
  proofExpiresAt: Date | null;

  @Column({ name: 'consumed_at', type: 'datetime', nullable: true })
  consumedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
