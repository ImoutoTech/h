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
    this.log(`获取角色权限: ${roleId}`);
    if (!roleId) {
      return [];
    }

    const role = await this.roleRepo.findOne({
      where: { id: Number(roleId) },
      relations: ['permissions'],
    });

    if (!role) {
      this.warn(`未找到角色: ${roleId}`);
      return [];
    }

    return role.permissions.map((permission) => permission.code);
  }

  async getPermissionByRoles(roles: string[]) {
    this.log(`获取多个角色权限: ${roles.join(', ')}`);

    if (!roles || roles.length === 0) {
      return [];
    }

    const roleIds = roles.map((id) => Number(id));
    const rolePermissions = await this.roleRepo.find({
      where: roleIds.map((id) => ({ id })),
      relations: ['permissions'],
    });

    // 合并所有角色的权限，并去重
    const permissions = new Set<string>();
    rolePermissions.forEach((role) => {
      role.permissions.forEach((permission) => {
        permissions.add(permission.code);
      });
    });

    return Array.from(permissions);
  }
}
