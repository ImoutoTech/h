import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UnifiedNotificationService1786464000000
  implements MigrationInterface
{
  name = 'UnifiedNotificationService1786464000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "CREATE TABLE `notification_channel_configs` (`channel_type` varchar(20) NOT NULL, `enabled` tinyint NOT NULL DEFAULT 0, `host` varchar(255) NULL, `port` smallint unsigned NULL, `tls_mode` varchar(20) NOT NULL DEFAULT 'starttls', `username` varchar(255) NULL, `password_ciphertext` text NULL, `password_iv` varchar(64) NULL, `password_tag` varchar(64) NULL, `password_hint` varchar(32) NULL, `key_version` varchar(32) NULL, `from_name` varchar(191) NULL, `from_address` varchar(320) NULL, `updated_by` int NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (`channel_type`), CONSTRAINT `fk_notification_channel_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL) ENGINE=InnoDB",
    );
    await queryRunner.query(
      'CREATE TABLE `notification_templates` (`id` char(36) NOT NULL, `key` varchar(100) NOT NULL, `name` varchar(191) NOT NULL, `enabled` tinyint NOT NULL DEFAULT 1, `subject` varchar(255) NOT NULL, `text` mediumtext NOT NULL, `html` mediumtext NULL, `allowed_variables` json NOT NULL, `updated_by` int NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE KEY `uq_notification_template_key` (`key`), PRIMARY KEY (`id`), CONSTRAINT `fk_notification_template_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL) ENGINE=InnoDB',
    );
    await queryRunner.query(
      'CREATE TABLE `subapp_notification_policies` (`app_id` varchar(36) NOT NULL, `direct_content` tinyint NOT NULL DEFAULT 0, `manual_recipient` tinyint NOT NULL DEFAULT 0, `updated_by` int NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (`app_id`), CONSTRAINT `fk_notification_policy_app` FOREIGN KEY (`app_id`) REFERENCES `subapps`(`id`) ON DELETE CASCADE, CONSTRAINT `fk_notification_policy_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE SET NULL) ENGINE=InnoDB',
    );
    await queryRunner.query(
      'CREATE TABLE `notification_template_grants` (`id` int NOT NULL AUTO_INCREMENT, `app_id` varchar(36) NOT NULL, `template_id` char(36) NOT NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), UNIQUE KEY `uq_notification_template_grant` (`app_id`,`template_id`), PRIMARY KEY (`id`), CONSTRAINT `fk_notification_grant_app` FOREIGN KEY (`app_id`) REFERENCES `subapps`(`id`) ON DELETE CASCADE, CONSTRAINT `fk_notification_grant_template` FOREIGN KEY (`template_id`) REFERENCES `notification_templates`(`id`) ON DELETE CASCADE) ENGINE=InnoDB',
    );
    await queryRunner.query(
      'CREATE TABLE `notification_api_keys` (`id` char(36) NOT NULL, `app_id` varchar(36) NOT NULL, `digest` char(64) NOT NULL, `hint` varchar(32) NOT NULL, `enabled` tinyint NOT NULL DEFAULT 1, `created_by` int NULL, `last_used_at` datetime NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (`id`), KEY `idx_notification_api_key_app` (`app_id`), CONSTRAINT `fk_notification_api_key_app` FOREIGN KEY (`app_id`) REFERENCES `subapps`(`id`) ON DELETE CASCADE, CONSTRAINT `fk_notification_api_key_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL) ENGINE=InnoDB',
    );
    await queryRunner.query(
      "CREATE TABLE `notifications` (`id` char(36) NOT NULL, `caller_kind` varchar(20) NOT NULL, `caller_key` varchar(150) NOT NULL, `app_id` varchar(36) NULL, `internal_name` varchar(100) NULL, `idempotency_key` varchar(191) NULL, `request_hash` char(64) NOT NULL, `channel_type` varchar(20) NOT NULL DEFAULT 'email', `subject_ciphertext` mediumtext NULL, `subject_iv` varchar(64) NULL, `subject_tag` varchar(64) NULL, `text_ciphertext` mediumtext NULL, `text_iv` varchar(64) NULL, `text_tag` varchar(64) NULL, `html_ciphertext` mediumtext NULL, `html_iv` varchar(64) NULL, `html_tag` varchar(64) NULL, `key_version` varchar(32) NULL, `status` varchar(30) NOT NULL DEFAULT 'pending', `total_count` smallint unsigned NOT NULL, `sent_count` smallint unsigned NOT NULL DEFAULT 0, `failed_count` smallint unsigned NOT NULL DEFAULT 0, `payload_purged_at` datetime NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE KEY `uq_notification_idempotency` (`caller_key`,`idempotency_key`), KEY `idx_notification_app` (`app_id`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );
    await queryRunner.query(
      "CREATE TABLE `notification_deliveries` (`id` char(36) NOT NULL, `notification_id` char(36) NOT NULL, `recipient_ciphertext` text NULL, `recipient_iv` varchar(64) NULL, `recipient_tag` varchar(64) NULL, `recipient_digest` char(64) NOT NULL, `key_version` varchar(32) NULL, `status` varchar(20) NOT NULL DEFAULT 'pending', `attempts` tinyint unsigned NOT NULL DEFAULT 0, `next_attempt_at` datetime NULL, `lease_owner` varchar(100) NULL, `lease_expires_at` datetime NULL, `error_class` varchar(50) NULL, `sent_at` datetime NULL, `payload_purged_at` datetime NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), PRIMARY KEY (`id`), KEY `idx_notification_delivery_claim` (`status`,`next_attempt_at`,`lease_expires_at`), KEY `idx_notification_delivery_notification` (`notification_id`), CONSTRAINT `fk_notification_delivery_notification` FOREIGN KEY (`notification_id`) REFERENCES `notifications`(`id`) ON DELETE CASCADE) ENGINE=InnoDB",
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query(
      'SELECT (SELECT COUNT(*) FROM `notification_channel_configs`) + (SELECT COUNT(*) FROM `notification_templates`) + (SELECT COUNT(*) FROM `subapp_notification_policies`) + (SELECT COUNT(*) FROM `notification_api_keys`) + (SELECT COUNT(*) FROM `notifications`) AS `count`',
    );
    if (Number(rows[0]?.count || 0) > 0) {
      throw new Error(
        'Cannot revert notification schema while notification configuration or records exist',
      );
    }
    await queryRunner.query('DROP TABLE `notification_deliveries`');
    await queryRunner.query('DROP TABLE `notifications`');
    await queryRunner.query('DROP TABLE `notification_api_keys`');
    await queryRunner.query('DROP TABLE `notification_template_grants`');
    await queryRunner.query('DROP TABLE `subapp_notification_policies`');
    await queryRunner.query('DROP TABLE `notification_templates`');
    await queryRunner.query('DROP TABLE `notification_channel_configs`');
  }
}
