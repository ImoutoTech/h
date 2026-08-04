import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './User';

export type ExternalProvider = 'github' | 'google';

@Entity({ name: 'external_identities' })
@Unique('uq_external_identity_provider_user', ['provider', 'providerUserId'])
export class ExternalIdentity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 20 })
  provider: ExternalProvider;

  @Column({ name: 'provider_user_id', type: 'varchar', length: 191 })
  providerUserId: string;

  @Column({ type: 'varchar', length: 320, nullable: true })
  email: string;

  @Column({
    name: 'display_name',
    type: 'varchar',
    length: 191,
    nullable: true,
  })
  displayName: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 1024, nullable: true })
  avatarUrl: string;

  @ManyToOne(() => User, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
