import type { MigrationInterface, QueryRunner } from 'typeorm';

export class UserActivityOverview1788192000000 implements MigrationInterface {
  name = 'UserActivityOverview1788192000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE `user_activity_events` (`id` varchar(36) NOT NULL, `actor_user_id` int NULL, `owner_user_id` int NULL, `app_id` varchar(36) NULL, `target_name` varchar(191) NULL, `category` varchar(32) NOT NULL, `action` varchar(64) NOT NULL, `outcome` varchar(24) NOT NULL, `metadata` json NULL, `dedupe_key` char(64) NULL, `occurred_at` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), INDEX `idx_user_activity_actor_occurred` (`actor_user_id`, `occurred_at`), INDEX `idx_user_activity_owner_occurred` (`owner_user_id`, `occurred_at`), INDEX `idx_user_activity_app_occurred` (`app_id`, `occurred_at`), UNIQUE INDEX `uq_user_activity_dedupe` (`dedupe_key`), PRIMARY KEY (`id`)) ENGINE=InnoDB',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `user_activity_events`');
  }
}
