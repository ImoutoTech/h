import { Entity, Column, PrimaryGeneratedColumn, ManyToOne } from 'typeorm';

import { SubApp } from './SubApp';

@Entity({
  name: 'subapp_secrets',
})
export class SubAppSecret {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SubApp, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  })
  app: SubApp;

  @Column({
    nullable: true,
  })
  value: string;

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

  @Column({
    nullable: false,
    type: 'boolean',
    default: true,
  })
  status: boolean;
}
