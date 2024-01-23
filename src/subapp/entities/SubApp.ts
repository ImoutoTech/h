import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Generated,
  PrimaryColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';

import { User } from '@/user/entities/user.entity';

@Entity({
  name: 'subapps',
})
export class SubApp {
  @Column()
  @Generated('uuid')
  @PrimaryColumn()
  id: string;

  @JoinColumn({
    name: 'owner',
  })
  @ManyToOne(() => User, {
    cascade: true,
  })
  owner: User;

  @Column({
    nullable: false,
  })
  callback: string;

  @Column({
    nullable: false,
  })
  name: string;

  @Column({
    default: '暂无描述',
  })
  description: string;

  @Column({
    default: 0,
  })
  visitNum: number;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
