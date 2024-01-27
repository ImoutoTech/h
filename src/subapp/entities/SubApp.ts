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
  @ManyToOne(() => User, (user) => user.subApps, {
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

  public getData() {
    return {
      name: this.name,
      id: this.id,
      callback: this.callback,
      owner: this.owner?.id,
      created_at: this.created_at,
      updated_at: this.updated_at,
      visitNum: this.visitNum,
      description: this.description,
    };
  }
}
