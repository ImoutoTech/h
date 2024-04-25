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
    default: 0,
  })
  value: string;

  @Column({
    nullable: false,
    type: 'boolean',
    default: true,
  })
  status: boolean;
}
