import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SubAppResourceGrants1786464000000 implements MigrationInterface {
  name = 'SubAppResourceGrants1786464000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE `subapp_resource_grants` (`id` int NOT NULL AUTO_INCREMENT, `appId` varchar(255) NOT NULL, `resource` varchar(64) NOT NULL, `scope` varchar(100) NOT NULL, UNIQUE KEY `uq_subapp_resource_scope` (`appId`, `resource`, `scope`), CONSTRAINT `fk_subapp_resource_grant_app` FOREIGN KEY (`appId`) REFERENCES `subapps`(`id`) ON DELETE CASCADE, PRIMARY KEY (`id`)) ENGINE=InnoDB',
    );
    const permissions = [
      [
        '管理 OAuth 机器授权',
        '预配 confidential client 并维护 resource/scope 授权',
        'oauth-machine-grant-admin',
      ],
      ['读取通知', '读取通知管理资源', 'notifications:read'],
      ['发送通知', '发送通知管理资源', 'notifications:send'],
      ['管理通知', '管理通知配置与状态', 'notifications:manage'],
    ];
    for (const [name, description, code] of permissions) {
      await queryRunner.query(
        'INSERT INTO `permission` (`name`, `desc`, `code`) SELECT ?, ?, ? FROM DUAL WHERE NOT EXISTS (SELECT 1 FROM `permission` WHERE `code` = ?)',
        [name, description, code, code],
      );
    }
    await queryRunner.query(
      "INSERT IGNORE INTO `role_permission_relation` (`roleId`, `permissionId`) SELECT `role`.`id`, `permission`.`id` FROM `role` INNER JOIN `permission` ON `permission`.`code` IN ('oauth-machine-grant-admin', 'notifications:read', 'notifications:send', 'notifications:manage') WHERE `role`.`name` = '管理员'",
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "DELETE `role_permission_relation` FROM `role_permission_relation` INNER JOIN `permission` ON `permission`.`id` = `role_permission_relation`.`permissionId` WHERE `permission`.`code` IN ('oauth-machine-grant-admin', 'notifications:read', 'notifications:send', 'notifications:manage')",
    );
    await queryRunner.query(
      "DELETE FROM `permission` WHERE `code` IN ('oauth-machine-grant-admin', 'notifications:read', 'notifications:send', 'notifications:manage')",
    );
    await queryRunner.query('DROP TABLE `subapp_resource_grants`');
  }
}
