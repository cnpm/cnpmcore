ALTER TABLE `tasks` ADD COLUMN `biz_id` varchar(100) NULL COMMENT 'unique biz id to keep task unique';
ALTER TABLE `tasks` ADD UNIQUE KEY `uk_biz_id` (`biz_id`);

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
