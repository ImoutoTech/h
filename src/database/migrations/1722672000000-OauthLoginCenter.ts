import type { MigrationInterface, QueryRunner } from 'typeorm';
import {
  decryptSecret,
  encryptSecret,
  parseSecretKey,
} from '../../module/identity/secret-envelope';

export class OauthLoginCenter1722672000000 implements MigrationInterface {
  name = 'OauthLoginCenter1722672000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const invalid = await queryRunner.query(
      "SELECT id, callback FROM subapps WHERE callback IS NULL OR callback = '' OR callback LIKE '%*%' OR callback NOT REGEXP '^https?://[^[:space:]]+$'",
    );
    if (invalid.length) {
      throw new Error(
        `Ambiguous OAuth callbacks: ${invalid.map((row) => row.id).join(',')}`,
      );
    }
    // Validate migration credentials and prepare every envelope before MySQL
    // performs any implicitly committed DDL.
    const legacySecrets = await queryRunner.query(
      'SELECT `id`, `appId`, `value` FROM `subapp_secrets` WHERE `value` IS NOT NULL',
    );
    let encryptedSecrets: Array<{ id: number; envelope: any }> = [];
    if (legacySecrets.length) {
      const key = parseSecretKey(
        process.env.OIDC_CLIENT_SECRET_KEY,
        'OIDC_CLIENT_SECRET_KEY',
      );
      const keyVersion = process.env.OIDC_CLIENT_SECRET_KEY_VERSION;
      if (!keyVersion)
        throw new Error('OIDC_CLIENT_SECRET_KEY_VERSION is required');
      encryptedSecrets = legacySecrets.map((secret) => ({
        id: secret.id,
        envelope: encryptSecret(
          secret.value,
          `oidc-client:${secret.appId}`,
          key,
          keyVersion,
        ),
      }));
    }
    await queryRunner.query(
      'ALTER TABLE `users` MODIFY `password` varchar(255) NULL',
    );
    await queryRunner.query(
      "ALTER TABLE `subapps` ADD `redirectUris` json NULL, ADD `clientType` varchar(20) NOT NULL DEFAULT 'public'",
    );
    await queryRunner.query(
      'UPDATE `subapps` SET `redirectUris` = JSON_ARRAY(`callback`)',
    );
    await queryRunner.query(
      'ALTER TABLE `subapps` MODIFY `redirectUris` json NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `subapp_secrets` MODIFY `value` varchar(255) NULL, ADD `secret_ciphertext` text NULL, ADD `secret_iv` varchar(64) NULL, ADD `secret_tag` varchar(64) NULL, ADD `secret_hint` varchar(32) NULL, ADD `key_version` varchar(32) NULL',
    );
    for (const secret of encryptedSecrets) {
      const { envelope } = secret;
      await queryRunner.query(
        'UPDATE `subapp_secrets` SET `value` = NULL, `secret_ciphertext` = ?, `secret_iv` = ?, `secret_tag` = ?, `secret_hint` = ?, `key_version` = ? WHERE `id` = ?',
        [
          envelope.ciphertext,
          envelope.iv,
          envelope.tag,
          envelope.hint,
          envelope.keyVersion,
          secret.id,
        ],
      );
    }
    await queryRunner.query(
      'CREATE TABLE `external_identities` (`id` int NOT NULL AUTO_INCREMENT, `provider` varchar(20) NOT NULL, `provider_user_id` varchar(191) NOT NULL, `email` varchar(320) NULL, `display_name` varchar(191) NULL, `avatar_url` varchar(1024) NULL, `user_id` int NOT NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE KEY `uq_external_identity_provider_user` (`provider`,`provider_user_id`), CONSTRAINT `fk_external_identity_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE, PRIMARY KEY (`id`)) ENGINE=InnoDB',
    );
    await queryRunner.query(
      'CREATE TABLE `provider_configs` (`provider` varchar(20) NOT NULL, `enabled` tinyint NOT NULL DEFAULT 0, `client_id` varchar(255) NULL, `secret_ciphertext` text NULL, `secret_iv` varchar(64) NULL, `secret_tag` varchar(64) NULL, `secret_hint` varchar(32) NULL, `key_version` varchar(32) NULL, `updated_by` int NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), CONSTRAINT `fk_provider_config_user` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL, PRIMARY KEY (`provider`)) ENGINE=InnoDB',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // MySQL implicitly commits DDL. Perform every rollback guard before the
    // first DROP/ALTER so a rejected rollback cannot leave a half-reverted
    // schema behind.
    const externalOnly = await queryRunner.query(
      'SELECT id FROM users WHERE password IS NULL LIMIT 1',
    );
    if (externalOnly.length)
      throw new Error(
        'Cannot restore NOT NULL password while external-only users exist',
      );
    const encryptedSecrets = await queryRunner.query(
      'SELECT `id`, `appId`, `secret_ciphertext`, `secret_iv`, `secret_tag`, `secret_hint`, `key_version` FROM `subapp_secrets` WHERE `secret_ciphertext` IS NOT NULL',
    );
    const plaintextSecrets: Array<{ id: number; value: string }> = [];
    if (encryptedSecrets.length) {
      const key = parseSecretKey(
        process.env.OIDC_CLIENT_SECRET_KEY,
        'OIDC_CLIENT_SECRET_KEY',
      );
      for (const secret of encryptedSecrets) {
        plaintextSecrets.push({
          id: secret.id,
          value: decryptSecret(
            {
              ciphertext: secret.secret_ciphertext,
              iv: secret.secret_iv,
              tag: secret.secret_tag,
              hint: secret.secret_hint,
              keyVersion: secret.key_version,
            },
            `oidc-client:${secret.appId}`,
            key,
          ),
        });
      }
    }
    await queryRunner.query('DROP TABLE `provider_configs`');
    await queryRunner.query('DROP TABLE `external_identities`');
    for (const secret of plaintextSecrets) {
      await queryRunner.query(
        'UPDATE `subapp_secrets` SET `value` = ? WHERE `id` = ?',
        [secret.value, secret.id],
      );
    }
    await queryRunner.query(
      'ALTER TABLE `subapps` DROP COLUMN `clientType`, DROP COLUMN `redirectUris`',
    );
    await queryRunner.query(
      'ALTER TABLE `subapp_secrets` DROP COLUMN `key_version`, DROP COLUMN `secret_hint`, DROP COLUMN `secret_tag`, DROP COLUMN `secret_iv`, DROP COLUMN `secret_ciphertext`, MODIFY `value` varchar(255) NOT NULL',
    );
    await queryRunner.query(
      'ALTER TABLE `users` MODIFY `password` varchar(255) NOT NULL',
    );
  }
}
