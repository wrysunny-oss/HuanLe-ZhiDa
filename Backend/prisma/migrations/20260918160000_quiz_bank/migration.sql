CREATE TABLE `quiz_categories` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(50) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `sort` INTEGER NOT NULL DEFAULT 0,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `quiz_categories_code_key`(`code`),
  INDEX `quiz_categories_enabled_sort_idx`(`enabled`, `sort`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `quiz_questions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `external_key` VARCHAR(160) NOT NULL,
  `category_id` BIGINT NOT NULL,
  `question_type` ENUM('SINGLE_CHOICE', 'TRUE_FALSE') NOT NULL DEFAULT 'SINGLE_CHOICE',
  `prompt` TEXT NOT NULL,
  `options` JSON NOT NULL,
  `answer_indexes` JSON NOT NULL,
  `explanation` TEXT NULL,
  `difficulty` INTEGER NOT NULL DEFAULT 1,
  `tags` JSON NULL,
  `status` ENUM('DRAFT', 'PUBLISHED', 'OFFLINE') NOT NULL DEFAULT 'DRAFT',
  `review_status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
  `source_name` VARCHAR(120) NOT NULL,
  `source_url` VARCHAR(1000) NOT NULL,
  `source_license` VARCHAR(80) NOT NULL,
  `source_record_id` VARCHAR(160) NULL,
  `content_hash` CHAR(64) NOT NULL,
  `reviewed_by_id` BIGINT NULL,
  `reviewed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `quiz_questions_external_key_key`(`external_key`),
  UNIQUE INDEX `quiz_questions_content_hash_key`(`content_hash`),
  INDEX `quiz_questions_category_id_status_review_status_idx`(`category_id`, `status`, `review_status`),
  INDEX `quiz_questions_source_name_source_record_id_idx`(`source_name`, `source_record_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `quiz_questions`
  ADD CONSTRAINT `quiz_questions_category_id_fkey`
  FOREIGN KEY (`category_id`) REFERENCES `quiz_categories`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
