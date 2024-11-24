ALTER TABLE `tasks` ADD COLUMN `biz_id` varchar(100) NULL COMMENT 'unique biz id to keep task unique';
ALTER TABLE `tasks` ADD UNIQUE KEY `uk_biz_id` (`biz_id`);
ALTER TABLE `packages` ADD COLUMN `registry_id` varchar(24) NULL COMMENT 'source registry';

CREATE TABLE IF NOT EXISTS `hooks` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `hook_id` varchar(24) NOT NULL COMMENT 'hook id',
  `type` varchar(20) NOT NULL COMMENT 'hook type, scope, name, owner',
  `name` varchar(428) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL COMMENT 'hook name',
  `owner_id` varchar(24) NOT NULL COMMENT 'hook owner id',
  `endpoint` varchar(2048) NOT NULL COMMENT 'hook url',
  `secret` varchar(200) NOT NULL COMMENT 'sign secret',
  `latest_task_id` varchar(24) NULL COMMENT 'latest task id',
  `enable` tinyint NOT NULL DEFAULT 0 COMMENT 'hook is enable not, 1: true, other: false',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_type_name_owner_id` (`type`, `name`, `owner_id`),
  KEY `idx_type_name_id` (`type`, `name`, `id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='task info';

CREATE TABLE IF NOT EXISTS `registries` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `registry_id` varchar(24) NOT NULL COMMENT 'registry id',
  `name` varchar(256) DEFAULT NULL COMMENT 'registry name',
  `host` varchar(4096) DEFAULT NULL COMMENT 'registry host',
  `change_stream` varchar(4096) DEFAULT NULL COMMENT 'change stream url',
  `type` varchar(256) DEFAULT NULL COMMENT 'registry type cnpmjsorg/cnpmcore/npm ',
  `user_prefix` varchar(256) DEFAULT NULL COMMENT 'user prefix',
  UNIQUE KEY `uk_name` (`name`),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='registry info';

CREATE TABLE IF NOT EXISTS `scopes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `scope_id` varchar(24) NOT NULL COMMENT 'scope id',
  `name` varchar(214) DEFAULT NULL COMMENT 'scope name',
  `registry_id` varchar(24) NOT NULL COMMENT 'registry id',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='scope info';
