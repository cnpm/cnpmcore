ALTER TABLE
  `tokens`
ADD
  COLUMN `name` varchar(255) DEFAULT NULL COMMENT 'token name',
ADD
  COLUMN `type` varchar(255) DEFAULT NULL COMMENT 'token type, granular or legacy',
ADD
  COLUMN `description` varchar(255) DEFAULT NULL COMMENT 'token description',
ADD
  COLUMN `allowed_scopes` TEXT DEFAULT NULL COMMENT 'scope allowed list',
ADD
  COLUMN `expired_at` datetime(3) DEFAULT NULL COMMENT 'token expiration time',
ADD
  UNIQUE KEY `uk_user_id_name` (`user_id`, `name`);

CREATE TABLE IF NOT EXISTS `token_packages` (
 `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
 `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
 `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
 `token_id` varchar(24) NOT NULL COMMENT 'token id',
 `package_id` varchar(24) NOT NULL COMMENT 'package id',
 PRIMARY KEY (`id`),
 UNIQUE KEY `uk_token_id_package_id` (`token_id`,`package_id`),
 KEY `idx_token_id` (`token_id`),
 KEY `idx_package_id` (`package_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='token allowed packages';
