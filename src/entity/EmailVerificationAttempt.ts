import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity({ name: 'email_verification_attempts' })
@Index('idx_email_verification_attempt_source', ['sourceHash', 'createdAt'])
export class EmailVerificationAttempt {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'challenge_id', type: 'varchar', length: 36 })
  challengeId: string;

  @Column({ name: 'source_hash', type: 'varchar', length: 64 })
  sourceHash: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
