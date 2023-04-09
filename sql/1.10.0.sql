CREATE TABLE IF NOT EXISTS `packages` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `package_id` varchar(24) NOT NULL COMMENT 'package id',
  `is_private` tinyint NOT NULL DEFAULT 0 COMMENT 'private pkg or not, 1: true, other: false',
  `name` varchar(214) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL COMMENT 'package name',
  `scope` varchar(214) NOT NULL COMMENT 'package name, empty string meaning no scope',
  `description` varchar(10240) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT 'package description',
  `abbreviateds_dist_id` varchar(24) NULL COMMENT 'all abbreviated manifests dist id',
  `manifests_dist_id` varchar(24) NULL COMMENT 'all full manifests dist id',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_package_id` (`package_id`),
  UNIQUE KEY `uk_scope_name` (`scope`,`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='package info';

CREATE TABLE IF NOT EXISTS `package_versions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `package_id` varchar(24) NOT NULL COMMENT 'package id',
  `package_version_id` varchar(24) NOT NULL COMMENT 'package version id',
  `version` varchar(256) NOT NULL COMMENT 'package version',
  `abbreviated_dist_id` varchar(24) NOT NULL COMMENT 'abbreviated manifest dist id',
  `manifest_dist_id` varchar(24) NOT NULL COMMENT 'manifest dist id',
  `tar_dist_id` varchar(24) NOT NULL COMMENT 'tar dist id',
  `readme_dist_id` varchar(24) NOT NULL COMMENT 'readme dist id',
  `publish_time` datetime(3) NOT NULL COMMENT 'publish time',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_package_version_id` (`package_version_id`),
  UNIQUE KEY `uk_package_id_version` (`package_id`, `version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='package version info';

CREATE TABLE IF NOT EXISTS `package_version_manifests` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `package_id` varchar(24) NOT NULL COMMENT 'package id',
  `package_version_id` varchar(24) NOT NULL COMMENT 'package version id',
  `package_version_manifest_id` varchar(24) NOT NULL COMMENT 'package version manifest id',
  `manifest` json NOT NULL COMMENT 'manifest JSON, including README text',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_package_version_manifest_id` (`package_version_manifest_id`),
  UNIQUE KEY `uk_package_version_id` (`package_version_id`),
  KEY `idx_package_id` (`package_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='package version manifest';

CREATE TABLE IF NOT EXISTS `package_version_downloads` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `year_month` int unsigned NOT NULL COMMENT 'YYYYMM format',
  `package_id` varchar(214) NOT NULL COMMENT 'package id, maybe scope name',
  `version` varchar(256) NOT NULL COMMENT 'package version',
  `d01` int unsigned NOT NULL DEFAULT 0 COMMENT '01 download count',
  `d02` int unsigned NOT NULL DEFAULT 0 COMMENT '02 download count',
  `d03` int unsigned NOT NULL DEFAULT 0 COMMENT '03 download count',
  `d04` int unsigned NOT NULL DEFAULT 0 COMMENT '04 download count',
  `d05` int unsigned NOT NULL DEFAULT 0 COMMENT '05 download count',
  `d06` int unsigned NOT NULL DEFAULT 0 COMMENT '06 download count',
  `d07` int unsigned NOT NULL DEFAULT 0 COMMENT '07 download count',
  `d08` int unsigned NOT NULL DEFAULT 0 COMMENT '08 download count',
  `d09` int unsigned NOT NULL DEFAULT 0 COMMENT '09 download count',
  `d10` int unsigned NOT NULL DEFAULT 0 COMMENT '10 download count',
  `d11` int unsigned NOT NULL DEFAULT 0 COMMENT '11 download count',
  `d12` int unsigned NOT NULL DEFAULT 0 COMMENT '12 download count',
  `d13` int unsigned NOT NULL DEFAULT 0 COMMENT '13 download count',
  `d14` int unsigned NOT NULL DEFAULT 0 COMMENT '14 download count',
  `d15` int unsigned NOT NULL DEFAULT 0 COMMENT '15 download count',
  `d16` int unsigned NOT NULL DEFAULT 0 COMMENT '16 download count',
  `d17` int unsigned NOT NULL DEFAULT 0 COMMENT '17 download count',
  `d18` int unsigned NOT NULL DEFAULT 0 COMMENT '18 download count',
  `d19` int unsigned NOT NULL DEFAULT 0 COMMENT '19 download count',
  `d20` int unsigned NOT NULL DEFAULT 0 COMMENT '20 download count',
  `d21` int unsigned NOT NULL DEFAULT 0 COMMENT '21 download count',
  `d22` int unsigned NOT NULL DEFAULT 0 COMMENT '22 download count',
  `d23` int unsigned NOT NULL DEFAULT 0 COMMENT '23 download count',
  `d24` int unsigned NOT NULL DEFAULT 0 COMMENT '24 download count',
  `d25` int unsigned NOT NULL DEFAULT 0 COMMENT '25 download count',
  `d26` int unsigned NOT NULL DEFAULT 0 COMMENT '26 download count',
  `d27` int unsigned NOT NULL DEFAULT 0 COMMENT '27 download count',
  `d28` int unsigned NOT NULL DEFAULT 0 COMMENT '28 download count',
  `d29` int unsigned NOT NULL DEFAULT 0 COMMENT '29 download count',
  `d30` int unsigned NOT NULL DEFAULT 0 COMMENT '30 download count',
  `d31` int unsigned NOT NULL DEFAULT 0 COMMENT '31 download count',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_year_month_package_id_version` (`year_month`, `package_id`, `version`),
  KEY `idx_packageid_yearmonth` (`package_id`, `year_month`),
  KEY `idx_year_month` (`year_month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='package version download total info';

CREATE TABLE IF NOT EXISTS `package_tags` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `package_id` varchar(24) NOT NULL COMMENT 'package id',
  `package_tag_id` varchar(24) NOT NULL COMMENT 'package tag id',
  `tag` varchar(214) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'package tag',
  `version` varchar(256) NOT NULL COMMENT 'package version',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_package_tag_id` (`package_tag_id`),
  UNIQUE KEY `uk_package_tag` (`package_id`, `tag`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='package tag info';

CREATE TABLE IF NOT EXISTS `package_deps` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `package_version_id` varchar(24) NOT NULL COMMENT 'package version id',
  `package_dep_id` varchar(24) NOT NULL COMMENT 'package dep id',
  `scope` varchar(214) NOT NULL COMMENT 'package scope',
  `name` varchar(214) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL COMMENT 'package name',
  `spec` varchar(100) NOT NULL COMMENT 'package dep spec',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_package_dep_id` (`package_dep_id`),
  UNIQUE KEY `uk_package_version_id_scope_name` (`package_version_id`, `scope`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='package dependency info';

CREATE TABLE IF NOT EXISTS `dists` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `dist_id` varchar(24) NOT NULL COMMENT 'dist id',
  `name` varchar(428) NOT NULL COMMENT 'dist name, 2x size of package name',
  `path` varchar(767) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL COMMENT 'access path',
  `size` int(10) unsigned NOT NULL COMMENT 'file size',
  `shasum` varchar(512) NOT NULL COMMENT 'dist shasum',
  `integrity` varchar(512) NOT NULL COMMENT 'dist integrity',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dist_id` (`dist_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='dist info';

CREATE TABLE IF NOT EXISTS `total` (
 `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
 `total_id` varchar(24) NOT NULL COMMENT 'total id, should set it to "global"',
 `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
 `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
 `package_count` bigint(20) unsigned NOT NULL DEFAULT 0 COMMENT 'package count',
 `package_file_size` bigint(20) unsigned NOT NULL DEFAULT 0 COMMENT 'package all files total size',
 `package_version_count` bigint(20) unsigned NOT NULL DEFAULT 0 COMMENT 'package version count',
 `package_version_delete_count` bigint(20) unsigned NOT NULL DEFAULT 0 COMMENT 'package version delete count',
 `private_package_count` bigint(20) unsigned NOT NULL DEFAULT 0 COMMENT 'private package count',
 `private_package_file_size` bigint(20) unsigned NOT NULL DEFAULT 0 COMMENT 'private package all files total size',
 `private_package_version_count` bigint(20) unsigned NOT NULL DEFAULT 0 COMMENT 'private package version count',
 `private_package_version_delete_count` bigint(20) unsigned NOT NULL DEFAULT 0 COMMENT 'private package version delete count',
 `change_stream_seq` varchar(100) NULL COMMENT 'npm change stream sync data seq id',
 PRIMARY KEY (`id`),
 UNIQUE KEY `uk_total_id` (`total_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COMMENT='total info';

CREATE TABLE IF NOT EXISTS `package_version_blocks` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `package_version_block_id` varchar(24) NOT NULL COMMENT 'package version block id',
  `package_id` varchar(24) NOT NULL COMMENT 'package id',
  `version` varchar(256) NOT NULL COMMENT 'package version, "*" meaning all versions',
  `reason` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'block reason',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_package_version_block_id` (`package_version_block_id`),
  UNIQUE KEY `uk_name_version` (`package_id`, `version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='blocklist package versions';

CREATE TABLE IF NOT EXISTS `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `user_id` varchar(24) NOT NULL COMMENT 'user id',
  `name` varchar(100) NOT NULL COMMENT 'user name',
  `email` varchar(400) NOT NULL COMMENT 'user email',
  `password_salt` varchar(100) NOT NULL COMMENT 'password salt',
  `password_integrity` varchar(512) NOT NULL COMMENT 'password integrity',
  `ip` varchar(100) NOT NULL COMMENT 'user login request ip',
  `is_private` tinyint NOT NULL DEFAULT 1 COMMENT 'private user or not, 1: true, other: false',
  `scopes` json NULL COMMENT 'white scope list, ["@cnpm", "@foo"]',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_id` (`user_id`),
  UNIQUE KEY `uk_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='user info';

CREATE TABLE IF NOT EXISTS `tokens` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `token_id` varchar(24) NOT NULL COMMENT 'token id',
  `token_mark` varchar(20) NOT NULL COMMENT 'token mark value',
  `token_key` varchar(200) NOT NULL COMMENT 'token value sha512 hex',
  `is_readonly` tinyint NOT NULL DEFAULT 0 COMMENT 'readonly token or not, 1: true, other: false',
  `is_automation` tinyint NOT NULL DEFAULT 0 COMMENT 'automation token or not, 1: true, other: false',
  `cidr_whitelist` json NOT NULL COMMENT 'ip list, ["127.0.0.1"]',
  `user_id` varchar(24) NOT NULL COMMENT 'user id',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_token_id` (`token_id`),
  UNIQUE KEY `uk_token_key` (`token_key`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='token info';

CREATE TABLE IF NOT EXISTS `maintainers` (
 `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
 `gmt_create` datetime NOT NULL COMMENT 'create time',
 `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
 `package_id` varchar(24) NOT NULL COMMENT 'package id',
 `user_id` varchar(24) NOT NULL COMMENT 'user id',
 PRIMARY KEY (`id`),
 UNIQUE KEY `uk_package_id_user_id` (`package_id`,`user_id`),
 KEY `idx_package_id` (`package_id`),
 KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='package maintainers';

CREATE TABLE IF NOT EXISTS `tasks` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `task_id` varchar(24) NOT NULL COMMENT 'task id',
  `type` varchar(20) NOT NULL COMMENT 'task type',
  `state` varchar(20) NOT NULL COMMENT 'task state',
  `target_name` varchar(214) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL COMMENT 'target name, like package name / user name',
  `author_id` varchar(24) NOT NULL COMMENT 'create task user id',
  `author_ip` varchar(100) NOT NULL COMMENT 'create task user request ip',
  `data` json NULL COMMENT 'task params',
  `log_path` varchar(512) NOT NULL COMMENT 'access path',
  `log_store_position` varchar(10) NOT NULL COMMENT 'cloud store disk position',
  `attempts` int unsigned DEFAULT 0 COMMENT 'task execute attempts times',
  `error` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT 'error description',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_task_id` (`task_id`),
  KEY `idx_type_state_target_name` (`target_name`, `type`, `state`),
  KEY `idx_type_state_gmt_modified` (`type`, `state`, `gmt_modified`),
  KEY `idx_gmt_modified` (`gmt_modified`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='task info';

CREATE TABLE IF NOT EXISTS `history_tasks` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `task_id` varchar(24) NOT NULL COMMENT 'task id',
  `type` varchar(20) NOT NULL COMMENT 'task type',
  `state` varchar(20) NOT NULL COMMENT 'task state',
  `target_name` varchar(214) NOT NULL COMMENT 'target name, like package name / user name',
  `author_id` varchar(24) NOT NULL COMMENT 'create task user id',
  `author_ip` varchar(100) NOT NULL COMMENT 'create task user request ip',
  `data` json NULL COMMENT 'task params',
  `log_path` varchar(512) NOT NULL COMMENT 'access path',
  `log_store_position` varchar(10) NOT NULL COMMENT 'cloud store disk position',
  `attempts` int unsigned DEFAULT 0 COMMENT 'task execute attempts times',
  `error` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL COMMENT 'error description',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_task_id` (`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='history task info';

CREATE TABLE IF NOT EXISTS `changes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `change_id` varchar(24) NOT NULL COMMENT 'change id',
  `type` varchar(50) NOT NULL COMMENT 'change type',
  `target_name` varchar(214) NOT NULL COMMENT 'target name, like package name / user name',
  `data` json NULL COMMENT 'change params',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_change_id` (`change_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='change info';

CREATE TABLE IF NOT EXISTS `binaries` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `binary_id` varchar(24) NOT NULL COMMENT 'binary id',
  `category` varchar(50) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL COMMENT 'binary category, e.g.: node, sass',
  `parent` varchar(500) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL COMMENT 'binary parent name, e.g.: /, /v1.0.0/, /v1.0.0/docs/',
  `name` varchar(200) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL COMMENT 'binary name, dir should ends with /',
  `is_dir` tinyint NOT NULL DEFAULT 0 COMMENT 'is dir or not, 1: true, other: false',
  `size` int unsigned NOT NULL COMMENT 'file size',
  `date` varchar(100) NOT NULL COMMENT 'date display string',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_binary_id` (`binary_id`),
  UNIQUE KEY `uk_category_parent_name` (`category`, `parent`, `name`),
  KEY `idx_category_parent` (`category`, `parent`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='binary info';
