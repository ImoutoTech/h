import {
  Entity,
  Column,
  OneToOne,
  JoinColumn,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { SubApp } from './SubApp';

export enum AppStatus {
  CLOSED = 0,
  RUNNING = 1,
  BANNED = 2,
}

export interface SubAppMetaExportData {
  visitNum: number;
  status: AppStatus;
}

@Entity({
  name: 'subapp_meta',
})
export class SubAppMeta {
  @PrimaryGeneratedColumn()
  id: number;

  @JoinColumn()
  @OneToOne(() => SubApp, {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    cascade: true,
  })
  app: SubApp;

  @Column({
    default: 0,
  })
  visitNum: number;

  @Column({
    nullable: false,
    type: 'enum',
    enum: AppStatus,
    default: AppStatus.RUNNING,
  })
  status: AppStatus;

  public getData(): SubAppMetaExportData {
    return {
      visitNum: this.visitNum,
      status: this.status,
    };
  }
}
