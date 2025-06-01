import { Inject, Injectable } from '@nestjs/common';
import { HLogger, HLOGGER_TOKEN } from '@reus-able/nestjs';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role, Permission, User } from '@/entity';
import { PERMISSION_LIST, ROLE_LIST } from '@/utils/constants';
import { UserRole } from '@reus-able/types';

@Injectable()
export class SystemService {
  @Inject(HLOGGER_TOKEN)
  private logger: HLogger;

  @InjectRepository(Role)
  private roleRepo: Repository<Role>;

  @InjectRepository(Permission)
  private permissionRepo: Repository<Permission>;

  @InjectRepository(User)
  private userRepo: Repository<User>;

  private log(text: string) {
    this.logger.log(text, SystemService.name);
  }

  private warn(text: string) {
    this.logger.warn(text, SystemService.name);
  }

  async checkIsInit() {
    const permissions = await this.permissionRepo.count();
    const roles = await this.roleRepo.count();
    this.log(`检查是否初始化: 权限数量: ${permissions}, 角色数量: ${roles}`);
    return permissions > 0 && roles > 0;
  }

  async clearSystem() {
    await this.roleRepo.delete({});
    await this.permissionRepo.delete({});
    this.log('系统已清空');
  }

  async initPermissions() {
    this.log('初始化权限');
    const permissions = PERMISSION_LIST.map((p) => {
      const permission = new Permission();
      permission.name = p.name;
      permission.desc = p.description;
      permission.code = p.code;
      this.log(`权限[${permission.name}]已生成，code: ${permission.code}`);
      return permission;
    });
    await this.permissionRepo.save(permissions);
    this.log('权限初始化完成');
    return permissions;
  }

  async initRoles(permissions: Permission[]) {
    this.log('初始化角色');
    const roles = ROLE_LIST.map((r) => {
      const role = new Role();
      role.name = r.name;
      role.permissions = permissions.filter((p) =>
        r.permissions.some((rp) => rp === p.code),
      );
      this.log(`角色[${role.name}]已生成`);
      return role;
    });
    await this.roleRepo.save(roles);

    // 为所有用户添加默认角色
    const users = await this.userRepo.find();
    const adminRole = roles.find((r) => r.name === '管理员');
    const userRole = roles.find((r) => r.name === '用户');
    for (const user of users) {
      const targetRole = user.role === UserRole.ADMIN ? adminRole : userRole;
      user.roles = [targetRole];
      this.log(`用户[${user.nickname}]已添加角色[${targetRole.name}]`);
    }
    await this.userRepo.save(users);
    this.log('用户角色数据初始化完成');

    this.log('角色初始化完成');
    return roles;
  }

  async init(force = false) {
    const isInit = await this.checkIsInit();
    if (isInit && !force) {
      this.warn('系统已初始化，跳过初始化');
      return true;
    }
    await this.clearSystem();
    const permissions = await this.initPermissions();
    await this.initRoles(permissions);
    this.log('初始化完成');
    return true;
  }
}
