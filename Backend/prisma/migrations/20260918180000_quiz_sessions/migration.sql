CREATE TABLE `quiz_sessions` (
  `id` CHAR(36) NOT NULL,
  `request_id` CHAR(36) NOT NULL,
  `user_id` BIGINT NOT NULL,
  `category_id` BIGINT NULL,
  `status` ENUM('IN_PROGRESS', 'COMPLETED', 'ABANDONED') NOT NULL DEFAULT 'IN_PROGRESS',
  `total_questions` INTEGER NOT NULL,
  `answered_count` INTEGER NOT NULL DEFAULT 0,
  `correct_count` INTEGER NOT NULL DEFAULT 0,
  `reward_coins` BIGINT NOT NULL DEFAULT 0,
  `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completed_at` DATETIME(3) NULL,

  UNIQUE INDEX `quiz_sessions_user_id_request_id_key`(`user_id`, `request_id`),
  INDEX `quiz_sessions_user_id_started_at_idx`(`user_id`, `started_at`),
  INDEX `quiz_sessions_status_started_at_idx`(`status`, `started_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `quiz_session_questions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `session_id` CHAR(36) NOT NULL,
  `question_id` BIGINT NOT NULL,
  `position` INTEGER NOT NULL,
  `prompt_snapshot` TEXT NOT NULL,
  `options_snapshot` JSON NOT NULL,
  `answer_indexes_snapshot` JSON NOT NULL,
  `explanation_snapshot` TEXT NULL,
  `category_name_snapshot` VARCHAR(100) NOT NULL,
  `selected_indexes` JSON NULL,
  `is_correct` BOOLEAN NULL,
  `answered_at` DATETIME(3) NULL,

  UNIQUE INDEX `quiz_session_questions_session_id_position_key`(`session_id`, `position`),
  UNIQUE INDEX `quiz_session_questions_session_id_question_id_key`(`session_id`, `question_id`),
  INDEX `quiz_session_questions_question_id_idx`(`question_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `quiz_sessions`
  ADD CONSTRAINT `quiz_sessions_user_id_fkey`
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `quiz_sessions`
  ADD CONSTRAINT `quiz_sessions_category_id_fkey`
  FOREIGN KEY (`category_id`) REFERENCES `quiz_categories`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `quiz_session_questions`
  ADD CONSTRAINT `quiz_session_questions_session_id_fkey`
  FOREIGN KEY (`session_id`) REFERENCES `quiz_sessions`(`id`)
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `quiz_session_questions`
  ADD CONSTRAINT `quiz_session_questions_question_id_fkey`
  FOREIGN KEY (`question_id`) REFERENCES `quiz_questions`(`id`)
  ON DELETE RESTRICT ON UPDATE CASCADE;
