ALTER TABLE
  `tokens`
ADD
  COLUMN `name` varchar(255) DEFAULT NULL COMMENT 'token name',
ADD
  COLUMN `type` varchar(255) DEFAULT NULL COMMENT 'token type, granular or legacy',
ADD
  COLUMN `description` varchar(255) DEFAULT NULL COMMENT 'token description',
ADD
  COLUMN `allowed_packages` TEXT DEFAULT NULL COMMENT 'package allowed list',
ADD
  COLUMN `allowed_scopes` TEXT DEFAULT NULL COMMENT 'scope allowed list',
ADD
  COLUMN `expires` int unsigned DEFAULT NULL COMMENT 'token expiration time, in days',
ADD
  UNIQUE KEY `uk_user_id_name` (`user_id`, `name`);
