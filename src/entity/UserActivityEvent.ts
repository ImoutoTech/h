import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type {
  ActivityAction,
  ActivityCategory,
  ActivityMetadata,
  ActivityOutcome,
} from '@/module/activity/activity.types';

@Entity({ name: 'user_activity_events' })
@Index('idx_user_activity_actor_occurred', ['actorUserId', 'occurredAt'])
@Index('idx_user_activity_owner_occurred', ['ownerUserId', 'occurredAt'])
@Index('idx_user_activity_app_occurred', ['appId', 'occurredAt'])
@Index('uq_user_activity_dedupe', ['dedupeKey'], { unique: true })
export class UserActivityEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'actor_user_id', type: 'int', nullable: true })
  actorUserId: number | null;

  @Column({ name: 'owner_user_id', type: 'int', nullable: true })
  ownerUserId: number | null;

  @Column({ name: 'app_id', type: 'varchar', length: 36, nullable: true })
  appId: string | null;

  @Column({ name: 'target_name', type: 'varchar', length: 191, nullable: true })
  targetName: string | null;

  @Column({ type: 'varchar', length: 32 })
  category: ActivityCategory;

  @Column({ type: 'varchar', length: 64 })
  action: ActivityAction;

  @Column({ type: 'varchar', length: 24 })
  outcome: ActivityOutcome;

  @Column({ type: 'json', nullable: true })
  metadata: ActivityMetadata | null;

  @Column({ name: 'dedupe_key', type: 'char', length: 64, nullable: true })
  dedupeKey: string | null;

  @CreateDateColumn({ name: 'occurred_at', type: 'datetime', precision: 6 })
  occurredAt: Date;
}
