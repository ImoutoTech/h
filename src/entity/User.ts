import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToMany,
  JoinTable,
} from 'typeorm';

import * as bcrypt from 'bcrypt';
import { SubApp } from '@/entity/SubApp';
import { UserRole } from '@reus-able/types';
import { Role } from './Role';

export interface UserExportData {
  id: number;
  nickname: string;
  role: UserRole;
  email: string;
  avatar?: string;
  created_at: Date;
  updated_at: Date;
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

  @ManyToMany(() => Role)
  @JoinTable({
    name: 'user_role_relation',
  })
  roles: Role[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  public getData(): UserExportData {
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
