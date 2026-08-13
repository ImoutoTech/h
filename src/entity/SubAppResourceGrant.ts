import {
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SubApp } from './SubApp';

@Entity({ name: 'subapp_resource_grants' })
@Index('uq_subapp_resource_scope', ['app', 'resource', 'scope'], {
  unique: true,
})
export class SubAppResourceGrant {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => SubApp, (app) => app.resourceGrants, {
    onDelete: 'CASCADE',
    nullable: false,
  })
  app: SubApp;

  @Column({ type: 'varchar', length: 64 })
  resource: string;

  @Column({ type: 'varchar', length: 100 })
  scope: string;
}
