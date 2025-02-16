import { Inject, Injectable } from '@nestjs/common';
import { HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role, Permission } from '@/entity';
import { PermissionService } from '@reus-able/nestjs';

@Injectable()
export class AuthPermissionService implements PermissionService {
  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  @InjectRepository(Role)
  private roleRepo: Repository<Role>;

  @InjectRepository(Permission)
  private permissionRepo: Repository<Permission>;

  private log(text: string) {
    this.logger.log(text, AuthPermissionService.name);
  }

  private warn(text: string) {
    this.logger.warn(text, AuthPermissionService.name);
  }

  async getPermissionByRole(roleId: string) {
    console.log('获取角色权限', roleId);
    return [roleId];
  }

  async getPermissionByRoles(roles: string[]) {
    console.log('获取角色权限', roles);
    return roles;
  }
}
