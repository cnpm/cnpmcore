CREATE TABLE IF NOT EXISTS `webauthn_credentials` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `wanc_id` varchar(24) NOT NULL COMMENT 'webauthn credential id',
  `user_id` varchar(24) NOT NULL COMMENT 'user id',
  `credential_id` varchar(200) NOT NULL COMMENT 'webauthn credential id',
  `public_key` varchar(512) NOT NULL COMMENT 'webauthn credential publick key',
  `browser_type` varchar(20) NULL DEFAULT null COMMENT 'user browser name',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_wanc_id` (`wanc_id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='webauthn credential info';
