ALTER TABLE
  `tokens`
ADD
  COLUMN `last_used_at` datetime(3) DEFAULT NULL COMMENT 'token last used time';
