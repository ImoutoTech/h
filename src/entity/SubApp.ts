import {
  Entity,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Generated,
  PrimaryColumn,
  ManyToOne,
  OneToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';

import { User } from '@/entity/User';
import { SubAppMeta, SubAppMetaExportData } from './SubAppMeta';
import { SubAppSecret } from './SubAppSecret';

export interface SubAppExportData {
  name: string;
  id: string;
  callback: string;
  owner: number;
  created_at: Date;
  updated_at: Date;
  visitNum: number;
  description: string;
  meta: SubAppMetaExportData;
}

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

  // @Column({
  //   default: 0,
  // })
  // visitNum: number;

  @OneToMany(() => SubAppSecret, (s) => s.app, {
    cascade: true,
  })
  secrets: SubAppSecret[];

  @OneToOne(() => SubAppMeta, (m) => m.app, {
    cascade: true,
  })
  meta: SubAppMeta;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  public getData(): SubAppExportData {
    return {
      name: this.name,
      id: this.id,
      callback: this.callback,
      owner: this.owner?.id,
      created_at: this.created_at,
      updated_at: this.updated_at,
      visitNum: this.meta?.visitNum,
      description: this.description,
      meta: this.meta?.getData(),
    };
  }
}
