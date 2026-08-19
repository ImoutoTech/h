import type { MigrationInterface, QueryRunner } from 'typeorm';

export class SsoEmailVerification1787100000000 implements MigrationInterface {
  name = 'SsoEmailVerification1787100000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      "INSERT INTO `notification_templates` (`id`, `key`, `name`, `enabled`, `subject`, `text`, `html`, `allowed_variables`) VALUES ('8df6d453-17fa-4f95-9017-0d64d42425ce', 'account.email.verify', '账号邮箱验证', 1, '邮箱验证码', '您的验证码是 {{code}}。用途：{{purpose}}。过期时间：{{expiresAt}}。', NULL, JSON_ARRAY('code', 'purpose', 'expiresAt')) ON DUPLICATE KEY UPDATE `key` = VALUES(`key`)",
    );
    const hasVerifiedAt = await queryRunner.hasColumn(
      'users',
      'email_verified_at',
    );
    const hasVerificationSource = await queryRunner.hasColumn(
      'users',
      'email_verification_source',
    );
    if (!hasVerifiedAt) {
      await queryRunner.query(
        'ALTER TABLE `users` ADD `email_verified_at` datetime NULL',
      );
    }
    if (!hasVerificationSource) {
      await queryRunner.query(
        'ALTER TABLE `users` ADD `email_verification_source` varchar(32) NULL',
      );
    }
    await queryRunner.query(
      "UPDATE `users` SET `email_verified_at` = COALESCE(`email_verified_at`, CURRENT_TIMESTAMP), `email_verification_source` = COALESCE(`email_verification_source`, 'legacy_migration')",
    );
    await queryRunner.query(
      "CREATE TABLE `email_verification_challenges` (`id` varchar(36) NOT NULL, `purpose` enum ('register','change_email','change_password') NOT NULL, `user_id` int NULL, `email` varchar(320) NOT NULL, `source_hash` varchar(64) NOT NULL, `code_hash` varchar(64) NOT NULL, `expires_at` datetime NOT NULL, `resend_at` datetime NOT NULL, `failed_attempts` int NOT NULL DEFAULT 0, `max_attempts` int NOT NULL DEFAULT 5, `verified_at` datetime NULL, `proof_hash` varchar(64) NULL, `proof_expires_at` datetime NULL, `consumed_at` datetime NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX `idx_email_challenge_subject` (`purpose`, `user_id`, `email`), INDEX `idx_email_challenge_source` (`source_hash`, `created_at`), UNIQUE INDEX `uq_email_challenge_proof_hash` (`proof_hash`), PRIMARY KEY (`id`)) ENGINE=InnoDB",
    );
    await queryRunner.query(
      'CREATE TABLE `email_verification_attempts` (`id` int NOT NULL AUTO_INCREMENT, `challenge_id` varchar(36) NOT NULL, `source_hash` varchar(64) NOT NULL, `created_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX `idx_email_verification_attempt_source` (`source_hash`, `created_at`), PRIMARY KEY (`id`)) ENGINE=InnoDB',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `email_verification_attempts`');
    await queryRunner.query('DROP TABLE `email_verification_challenges`');
    await queryRunner.query(
      "DELETE FROM `notification_templates` WHERE `id` = '8df6d453-17fa-4f95-9017-0d64d42425ce'",
    );
    if (await queryRunner.hasColumn('users', 'email_verification_source')) {
      await queryRunner.query(
        'ALTER TABLE `users` DROP COLUMN `email_verification_source`',
      );
    }
    if (await queryRunner.hasColumn('users', 'email_verified_at')) {
      await queryRunner.query(
        'ALTER TABLE `users` DROP COLUMN `email_verified_at`',
      );
    }
  }
}
