import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';

import * as bcrypt from 'bcrypt';
import { SubApp } from '@/subapp/entities/SubApp';

export enum UserRole {
  ADMIN = 0,
  USER = 1,
}

@Entity({
  name: 'users',
})
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    nullable: false,
  })
  nickname: string;

  @Column({
    nullable: false,
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  role: number;

  @Column({
    nullable: false,
    unique: true,
  })
  email: string;

  @Column({
    nullable: false,
  })
  password: string;

  @Column({
    default: null,
  })
  avatar: string;

  @OneToMany(() => SubApp, (app) => app.owner)
  subApps: SubApp[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  public getData() {
    return {
      id: this.id,
      nickname: this.nickname,
      role: this.role,
      email: this.email,
      avatar: this.avatar,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }

  public checkPassword(pwd: string): boolean {
    return bcrypt.compareSync(pwd, this.password);
  }
}
