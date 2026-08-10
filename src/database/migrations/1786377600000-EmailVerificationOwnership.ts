import type { MigrationInterface, QueryRunner } from 'typeorm';

const LEGACY_VERIFICATION_TIME = '2026-08-10 00:00:00.000000';

export class EmailVerificationOwnership1786377600000
  implements MigrationInterface
{
  name = 'EmailVerificationOwnership1786377600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const columns: Array<{ COLUMN_NAME: string }> = await queryRunner.query(
      "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME IN ('email_verified_at', 'email_verification_source')",
    );
    const existing = new Set(columns.map((column) => column.COLUMN_NAME));
    if (!existing.has('email_verified_at')) {
      await queryRunner.query(
        'ALTER TABLE `users` ADD `email_verified_at` datetime(6) NULL',
      );
    }
    if (!existing.has('email_verification_source')) {
      await queryRunner.query(
        'ALTER TABLE `users` ADD `email_verification_source` varchar(32) NULL',
      );
    }
    await queryRunner.query(
      'UPDATE `users` SET `email_verified_at` = ?, `email_verification_source` = ? WHERE `email_verified_at` IS NULL',
      [LEGACY_VERIFICATION_TIME, 'legacy_migration'],
    );

    const tables: Array<{ TABLE_NAME: string }> = await queryRunner.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_verification_challenges'",
    );
    if (!tables.length) {
      await queryRunner.query(
        'CREATE TABLE `email_verification_challenges` (`id` char(36) NOT NULL, `purpose` varchar(20) NOT NULL, `user_id` int NULL, `normalized_email` varchar(320) NOT NULL, `active_key` char(64) NULL, `code_hash` char(64) NOT NULL, `expires_at` datetime(6) NOT NULL, `failed_attempts` smallint unsigned NOT NULL DEFAULT 0, `max_attempts` smallint unsigned NOT NULL, `resend_available_at` datetime(6) NOT NULL, `verified_at` datetime(6) NULL, `consumed_at` datetime(6) NULL, `invalidated_at` datetime(6) NULL, `notification_id` varchar(191) NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), `updated_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), UNIQUE KEY `uq_email_challenge_active_key` (`active_key`), INDEX `idx_email_challenge_target` (`purpose`, `normalized_email`, `created_at`), INDEX `idx_email_challenge_user_purpose` (`user_id`, `purpose`, `created_at`), CONSTRAINT `fk_email_challenge_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE, PRIMARY KEY (`id`)) ENGINE=InnoDB',
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // MySQL DDL implicitly commits. Reject before the first DROP whenever any
    // challenge state would be lost. User verification columns deliberately
    // remain in place so an application rollback never erases ownership facts.
    const tables: Array<{ TABLE_NAME: string }> = await queryRunner.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'email_verification_challenges'",
    );
    if (tables.length) {
      const challenge = await queryRunner.query(
        'SELECT `id` FROM `email_verification_challenges` LIMIT 1',
      );
      if (challenge.length) {
        throw new Error(
          'Cannot drop email verification challenges while records exist',
        );
      }
      await queryRunner.query('DROP TABLE `email_verification_challenges`');
    }
  }
}
