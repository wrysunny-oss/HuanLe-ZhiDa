CREATE TABLE `native_ad_task_attempts` (
  `id` VARCHAR(36) NOT NULL,
  `user_id` BIGINT NOT NULL,
  `selected_network_id` VARCHAR(4) NOT NULL,
  `actual_network_id` VARCHAR(4) NULL,
  `placement_id` VARCHAR(128) NOT NULL,
  `ad_show_id` VARCHAR(100) NULL,
  `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completed_at` DATETIME(3) NULL,

  UNIQUE INDEX `native_ad_task_attempts_placement_id_ad_show_id_key`(`placement_id`, `ad_show_id`),
  INDEX `native_ad_task_attempts_user_id_completed_at_idx`(`user_id`, `completed_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `native_ad_task_attempts`
  ADD CONSTRAINT `native_ad_task_attempts_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
