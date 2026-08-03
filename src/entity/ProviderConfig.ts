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
import type { ExternalProvider } from './ExternalIdentity';

@Entity({ name: 'provider_configs' })
export class ProviderConfig {
  @PrimaryColumn({ type: 'varchar', length: 20 })
  provider: ExternalProvider;

  @Column({ default: false })
  enabled: boolean;

  @Column({ name: 'client_id', type: 'varchar', length: 255, nullable: true })
  clientId: string;

  @Column({ name: 'secret_ciphertext', type: 'text', nullable: true })
  secretCiphertext: string;

  @Column({ name: 'secret_iv', type: 'varchar', length: 64, nullable: true })
  secretIv: string;

  @Column({ name: 'secret_tag', type: 'varchar', length: 64, nullable: true })
  secretTag: string;

  @Column({ name: 'secret_hint', type: 'varchar', length: 32, nullable: true })
  secretHint: string;

  @Column({ name: 'key_version', type: 'varchar', length: 32, nullable: true })
  keyVersion: string;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by' })
  updatedBy: User;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
