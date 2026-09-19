ALTER TABLE `quiz_sessions`
  ADD COLUMN `mode` ENUM('NORMAL', 'WRONG_REVIEW') NOT NULL DEFAULT 'NORMAL' AFTER `category_id`;

CREATE TABLE `quiz_wrong_questions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT NOT NULL,
  `question_id` BIGINT NOT NULL,
  `selected_indexes` JSON NOT NULL,
  `wrong_count` INTEGER NOT NULL DEFAULT 1,
  `first_wrong_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `last_wrong_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `quiz_wrong_questions_user_id_question_id_key`(`user_id`, `question_id`),
  INDEX `quiz_wrong_questions_user_id_last_wrong_at_idx`(`user_id`, `last_wrong_at`),
  INDEX `quiz_wrong_questions_question_id_idx`(`question_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `quiz_wrong_questions`
  ADD CONSTRAINT `quiz_wrong_questions_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `quiz_wrong_questions`
  ADD CONSTRAINT `quiz_wrong_questions_question_id_fkey`
  FOREIGN KEY (`question_id`) REFERENCES `quiz_questions`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
