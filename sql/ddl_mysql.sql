CREATE TABLE `binaries` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `binary_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'binary id',
  `category` varchar(50) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL COMMENT 'binary category, e.g.: node, sass',
  `parent` varchar(500) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL COMMENT 'binary parent name, e.g.: /, /v1.0.0/, /v1.0.0/docs/',
  `name` varchar(200) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL COMMENT 'binary name, dir should ends with /',
  `is_dir` tinyint NOT NULL DEFAULT '0' COMMENT 'is dir or not, 1: true, other: false',
  `size` int unsigned NOT NULL COMMENT 'file size',
  `date` varchar(100) COLLATE utf8_unicode_ci NOT NULL COMMENT 'date display string',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_binary_id` (`binary_id`),
  UNIQUE KEY `uk_category_parent_name` (`category`,`parent`,`name`),
  KEY `idx_category_parent_gmt_create` (`category`, `parent`, `gmt_create`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8_unicode_ci COMMENT='binary info'
;


CREATE TABLE `changes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `change_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'change id',
  `type` varchar(50) COLLATE utf8_unicode_ci NOT NULL COMMENT 'change type',
  `target_name` varchar(214) COLLATE utf8_unicode_ci NOT NULL COMMENT 'target name, like package name / user name',
  `data` json DEFAULT NULL COMMENT 'change params',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_change_id` (`change_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8_unicode_ci COMMENT='change info'
;


CREATE TABLE `dists` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `dist_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'dist id',
  `name` varchar(428) CHARACTER SET utf8 COLLATE utf8_unicode_ci NOT NULL COMMENT 'dist name, 2x size of package name',
  `path` varchar(767) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL COMMENT 'access path',
  `size` int unsigned NOT NULL COMMENT 'file size',
  `shasum` varchar(512) COLLATE utf8_unicode_ci NOT NULL COMMENT 'dist shasum',
  `integrity` varchar(512) COLLATE utf8_unicode_ci NOT NULL COMMENT 'dist integrity',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dist_id` (`dist_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8_unicode_ci COMMENT='dist info'
;


CREATE TABLE `history_tasks` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `task_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'task id',
  `type` varchar(20) COLLATE utf8_unicode_ci NOT NULL COMMENT 'task type',
  `state` varchar(20) COLLATE utf8_unicode_ci NOT NULL COMMENT 'task state',
  `target_name` varchar(214) COLLATE utf8_unicode_ci NOT NULL COMMENT 'target name, like package name / user name',
  `author_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'create task user id',
  `author_ip` varchar(100) COLLATE utf8_unicode_ci NOT NULL COMMENT 'create task user request ip',
  `data` json DEFAULT NULL COMMENT 'task params',
  `log_path` varchar(512) COLLATE utf8_unicode_ci NOT NULL COMMENT 'access path',
  `log_store_position` varchar(10) COLLATE utf8_unicode_ci NOT NULL COMMENT 'cloud store disk position',
  `attempts` int unsigned DEFAULT '0' COMMENT 'task execute attempts times',
  `error` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'error description',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_task_id` (`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8_unicode_ci COMMENT='history task info'
;


CREATE TABLE `hooks` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `hook_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'hook id',
  `type` varchar(20) COLLATE utf8_unicode_ci NOT NULL COMMENT 'hook type, scope, name, owner',
  `name` varchar(428) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL COMMENT 'hook name',
  `owner_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'hook owner id',
  `endpoint` varchar(2048) COLLATE utf8_unicode_ci NOT NULL COMMENT 'hook url',
  `secret` varchar(200) COLLATE utf8_unicode_ci NOT NULL COMMENT 'sign secret',
  `latest_task_id` varchar(24) COLLATE utf8_unicode_ci DEFAULT NULL COMMENT 'latest task id',
  `enable` tinyint NOT NULL DEFAULT '0' COMMENT 'hook is enable not, 1: true, other: false',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_type_name_owner_id` (`type`,`name`,`owner_id`),
  KEY `idx_type_name_id` (`type`,`name`,`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8_unicode_ci COMMENT='task info'
;


CREATE TABLE `maintainers` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `package_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'package id',
  `user_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'user id',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_package_id_user_id` (`package_id`,`user_id`),
  KEY `idx_package_id` (`package_id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8_unicode_ci COMMENT='package maintainers'
;


CREATE TABLE `package_deps` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `package_version_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'package version id',
  `package_dep_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'package dep id',
  `scope` varchar(214) COLLATE utf8_unicode_ci NOT NULL COMMENT 'package scope',
  `name` varchar(214) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL COMMENT 'package name',
  `spec` varchar(100) COLLATE utf8_unicode_ci NOT NULL COMMENT 'package dep spec',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_package_dep_id` (`package_dep_id`),
  UNIQUE KEY `uk_package_version_id_scope_name` (`package_version_id`,`scope`,`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8_unicode_ci COMMENT='package dependency info'
;


CREATE TABLE `package_tags` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `package_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'package id',
  `package_tag_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'package tag id',
  `tag` varchar(214) COLLATE utf8_unicode_ci NOT NULL COMMENT 'package tag',
  `version` varchar(256) COLLATE utf8_unicode_ci NOT NULL COMMENT 'package version',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_package_tag_id` (`package_tag_id`),
  UNIQUE KEY `uk_package_tag` (`package_id`,`tag`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8_unicode_ci COMMENT='package tag info'
;


CREATE TABLE `package_version_blocks` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `package_version_block_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'package version block id',
  `package_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'package id',
  `version` varchar(256) COLLATE utf8_unicode_ci NOT NULL COMMENT 'package version, "*" meaning all versions',
  `reason` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'block reason',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_package_version_block_id` (`package_version_block_id`),
  UNIQUE KEY `uk_name_version` (`package_id`,`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8_unicode_ci COMMENT='blocklist package versions'
;


CREATE TABLE `package_version_downloads` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `year_month` int unsigned NOT NULL COMMENT 'YYYYMM format',
  `package_id` varchar(214) COLLATE utf8_unicode_ci NOT NULL COMMENT 'package id, maybe scope name',
  `version` varchar(256) COLLATE utf8_unicode_ci NOT NULL COMMENT 'package version',
  `d01` int unsigned NOT NULL DEFAULT '0' COMMENT '01 download count',
  `d02` int unsigned NOT NULL DEFAULT '0' COMMENT '02 download count',
  `d03` int unsigned NOT NULL DEFAULT '0' COMMENT '03 download count',
  `d04` int unsigned NOT NULL DEFAULT '0' COMMENT '04 download count',
  `d05` int unsigned NOT NULL DEFAULT '0' COMMENT '05 download count',
  `d06` int unsigned NOT NULL DEFAULT '0' COMMENT '06 download count',
  `d07` int unsigned NOT NULL DEFAULT '0' COMMENT '07 download count',
  `d08` int unsigned NOT NULL DEFAULT '0' COMMENT '08 download count',
  `d09` int unsigned NOT NULL DEFAULT '0' COMMENT '09 download count',
  `d10` int unsigned NOT NULL DEFAULT '0' COMMENT '10 download count',
  `d11` int unsigned NOT NULL DEFAULT '0' COMMENT '11 download count',
  `d12` int unsigned NOT NULL DEFAULT '0' COMMENT '12 download count',
  `d13` int unsigned NOT NULL DEFAULT '0' COMMENT '13 download count',
  `d14` int unsigned NOT NULL DEFAULT '0' COMMENT '14 download count',
  `d15` int unsigned NOT NULL DEFAULT '0' COMMENT '15 download count',
  `d16` int unsigned NOT NULL DEFAULT '0' COMMENT '16 download count',
  `d17` int unsigned NOT NULL DEFAULT '0' COMMENT '17 download count',
  `d18` int unsigned NOT NULL DEFAULT '0' COMMENT '18 download count',
  `d19` int unsigned NOT NULL DEFAULT '0' COMMENT '19 download count',
  `d20` int unsigned NOT NULL DEFAULT '0' COMMENT '20 download count',
  `d21` int unsigned NOT NULL DEFAULT '0' COMMENT '21 download count',
  `d22` int unsigned NOT NULL DEFAULT '0' COMMENT '22 download count',
  `d23` int unsigned NOT NULL DEFAULT '0' COMMENT '23 download count',
  `d24` int unsigned NOT NULL DEFAULT '0' COMMENT '24 download count',
  `d25` int unsigned NOT NULL DEFAULT '0' COMMENT '25 download count',
  `d26` int unsigned NOT NULL DEFAULT '0' COMMENT '26 download count',
  `d27` int unsigned NOT NULL DEFAULT '0' COMMENT '27 download count',
  `d28` int unsigned NOT NULL DEFAULT '0' COMMENT '28 download count',
  `d29` int unsigned NOT NULL DEFAULT '0' COMMENT '29 download count',
  `d30` int unsigned NOT NULL DEFAULT '0' COMMENT '30 download count',
  `d31` int unsigned NOT NULL DEFAULT '0' COMMENT '31 download count',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_year_month_package_id_version` (`year_month`,`package_id`,`version`),
  KEY `idx_year_month` (`year_month`),
  KEY `idx_packageid_yearmonth` (`package_id`,`year_month`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8_unicode_ci COMMENT='package version download total info'
;


CREATE TABLE `package_version_files` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `package_version_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'package version id',
  `package_version_file_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'package version file id',
  `dist_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'file dist id',
  `directory` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'directory path, e.g.: /bin',
  `name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'file name, e.g.: index.js',
  `content_type` varchar(200) COLLATE utf8_unicode_ci NOT NULL COMMENT 'file content type, e.g.: application/javascript',
  `mtime` datetime(3) NOT NULL COMMENT 'file modified time',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_package_version_file_id` (`package_version_file_id`),
  UNIQUE KEY `ux_package_version_id_directory_name` (`package_version_id`,`directory`,`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8_unicode_ci COMMENT='package version file'
;


CREATE TABLE `package_version_manifests` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `package_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'package id',
  `package_version_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'package version id',
  `package_version_manifest_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'package version manifest id',
  `manifest` json NOT NULL COMMENT 'manifest JSON, including README text',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_package_version_manifest_id` (`package_version_manifest_id`),
  UNIQUE KEY `uk_package_version_id` (`package_version_id`),
  KEY `idx_package_id` (`package_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8_unicode_ci COMMENT='package version manifest'
;


CREATE TABLE `package_versions` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `package_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'package id',
  `package_version_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'package version id',
  `version` varchar(256) COLLATE utf8_unicode_ci NOT NULL COMMENT 'package version',
  `abbreviated_dist_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'abbreviated manifest dist id',
  `manifest_dist_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'manifest dist id',
  `tar_dist_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'tar dist id',
  `readme_dist_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'readme dist id',
  `publish_time` datetime(3) NOT NULL COMMENT 'publish time',
  `padding_version` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL COMMENT 'token name',
  `is_pre_release` tinyint DEFAULT NULL COMMENT '是否是先行版本',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_package_version_id` (`package_version_id`),
  UNIQUE KEY `uk_package_id_version` (`package_id`,`version`),
  KEY `idx_pkg_id_is_pre_release_padding_version` (`package_id`,`padding_version`,`is_pre_release`,`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8_unicode_ci COMMENT='package version info'
;


CREATE TABLE `packages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `package_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'package id',
  `is_private` tinyint NOT NULL DEFAULT '0' COMMENT 'private pkg or not, 1: true, other: false',
  `name` varchar(214) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL COMMENT 'package name',
  `scope` varchar(214) COLLATE utf8_unicode_ci NOT NULL COMMENT 'package name, empty string meaning no scope',
  `description` varchar(10240) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT 'package description',
  `abbreviateds_dist_id` varchar(24) COLLATE utf8_unicode_ci DEFAULT NULL COMMENT 'all abbreviated manifests dist id',
  `manifests_dist_id` varchar(24) COLLATE utf8_unicode_ci DEFAULT NULL COMMENT 'all full manifests dist id',
  `registry_id` varchar(24) COLLATE utf8_unicode_ci DEFAULT NULL COMMENT 'source registry',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_package_id` (`package_id`),
  UNIQUE KEY `uk_scope_name` (`scope`,`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8_unicode_ci COMMENT='package info'
;


CREATE TABLE `proxy_caches` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modify time',
  `fullname` varchar(214) COLLATE utf8_unicode_ci NOT NULL DEFAULT '' COMMENT '@scope/package name',
  `version` varchar(214) COLLATE utf8_unicode_ci DEFAULT NULL COMMENT 'package version',
  `file_type` varchar(30) COLLATE utf8_unicode_ci NOT NULL DEFAULT '' COMMENT 'file type',
  `file_path` varchar(512) COLLATE utf8_unicode_ci NOT NULL DEFAULT '' COMMENT 'nfs file path',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_package_version_path_name` (`file_path`),
  UNIQUE KEY `ux_package_version_file_name` (`fullname`,`file_type`,`version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8_unicode_ci COMMENT='proxy mode cached files index'
;


CREATE TABLE `registries` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `registry_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'registry id',
  `name` varchar(256) COLLATE utf8_unicode_ci DEFAULT NULL COMMENT 'registry name',
  `host` varchar(4096) COLLATE utf8_unicode_ci DEFAULT NULL COMMENT 'registry host',
  `change_stream` varchar(4096) COLLATE utf8_unicode_ci DEFAULT NULL COMMENT 'change stream url',
  `type` varchar(256) COLLATE utf8_unicode_ci DEFAULT NULL COMMENT 'registry type cnpmjsorg/cnpmcore/npm ',
  `user_prefix` varchar(256) COLLATE utf8_unicode_ci DEFAULT NULL COMMENT 'user prefix',
  `auth_token` varchar(256) COLLATE utf8_unicode_ci DEFAULT NULL COMMENT 'registry auth token',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8_unicode_ci COMMENT='registry info'
;


CREATE TABLE `scopes` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `scope_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'scope id',
  `name` varchar(214) COLLATE utf8_unicode_ci DEFAULT NULL COMMENT 'scope name',
  `registry_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'registry id',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8_unicode_ci COMMENT='scope info'
;


CREATE TABLE `tasks` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `task_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'task id',
  `type` varchar(20) COLLATE utf8_unicode_ci NOT NULL COMMENT 'task type',
  `state` varchar(20) COLLATE utf8_unicode_ci NOT NULL COMMENT 'task state',
  `target_name` varchar(214) CHARACTER SET utf8 COLLATE utf8_bin NOT NULL COMMENT 'target name, like package name / user name',
  `author_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'create task user id',
  `author_ip` varchar(100) COLLATE utf8_unicode_ci NOT NULL COMMENT 'create task user request ip',
  `data` json DEFAULT NULL COMMENT 'task params',
  `log_path` varchar(512) COLLATE utf8_unicode_ci NOT NULL COMMENT 'access path',
  `log_store_position` varchar(10) COLLATE utf8_unicode_ci NOT NULL COMMENT 'cloud store disk position',
  `attempts` int unsigned DEFAULT '0' COMMENT 'task execute attempts times',
  `error` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'error description',
  `biz_id` varchar(100) COLLATE utf8_unicode_ci DEFAULT NULL COMMENT 'unique biz id to keep task unique',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_task_id` (`task_id`),
  UNIQUE KEY `uk_biz_id` (`biz_id`),
  KEY `idx_type_state_target_name` (`target_name`,`type`,`state`),
  KEY `idx_type_state_gmt_modified` (`type`,`state`,`gmt_modified`),
  KEY `idx_gmt_modified` (`gmt_modified`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8_unicode_ci COMMENT='task info'
;


CREATE TABLE `token_packages` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `token_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'token id',
  `package_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'package id',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_token_id_package_id` (`token_id`,`package_id`),
  KEY `idx_token_id` (`token_id`),
  KEY `idx_package_id` (`package_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8_unicode_ci COMMENT='token allowed packages'
;


CREATE TABLE `tokens` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `token_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'token id',
  `token_mark` varchar(20) COLLATE utf8_unicode_ci NOT NULL COMMENT 'token mark value',
  `token_key` varchar(200) COLLATE utf8_unicode_ci NOT NULL COMMENT 'token value sha512 hex',
  `is_readonly` tinyint NOT NULL DEFAULT '0' COMMENT 'readonly token or not, 1: true, other: false',
  `is_automation` tinyint NOT NULL DEFAULT '0' COMMENT 'automation token or not, 1: true, other: false',
  `cidr_whitelist` json NOT NULL COMMENT 'ip list, ["127.0.0.1"]',
  `user_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'user id',
  `name` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL COMMENT 'token name',
  `type` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL COMMENT 'token type, granular or legacy',
  `description` varchar(255) COLLATE utf8_unicode_ci DEFAULT NULL COMMENT 'token description',
  `allowed_scopes` text COLLATE utf8_unicode_ci COMMENT 'scope allowed list',
  `expired_at` datetime(3) DEFAULT NULL COMMENT 'token expiration time',
  `last_used_at` datetime(3) DEFAULT NULL COMMENT 'token last used time',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_token_id` (`token_id`),
  UNIQUE KEY `uk_token_key` (`token_key`),
  UNIQUE KEY `uk_user_id_name` (`user_id`,`name`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8_unicode_ci COMMENT='token info'
;


CREATE TABLE `total` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `total_id` varchar(24) NOT NULL COMMENT 'total id, should set it to "global"',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `package_count` bigint unsigned NOT NULL DEFAULT '0' COMMENT 'package count',
  `package_file_size` bigint unsigned NOT NULL DEFAULT '0' COMMENT 'package all files total size',
  `package_version_count` bigint unsigned NOT NULL DEFAULT '0' COMMENT 'package version count',
  `package_version_delete_count` bigint unsigned NOT NULL DEFAULT '0' COMMENT 'package version delete count',
  `private_package_count` bigint unsigned NOT NULL DEFAULT '0' COMMENT 'private package count',
  `private_package_file_size` bigint unsigned NOT NULL DEFAULT '0' COMMENT 'private package all files total size',
  `private_package_version_count` bigint unsigned NOT NULL DEFAULT '0' COMMENT 'private package version count',
  `private_package_version_delete_count` bigint unsigned NOT NULL DEFAULT '0' COMMENT 'private package version delete count',
  `change_stream_seq` varchar(100) DEFAULT NULL COMMENT 'npm change stream sync data seq id',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_total_id` (`total_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COMMENT='total info'
;


CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `user_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'user id',
  `name` varchar(100) COLLATE utf8_unicode_ci NOT NULL COMMENT 'user name',
  `email` varchar(400) COLLATE utf8_unicode_ci NOT NULL COMMENT 'user email',
  `password_salt` varchar(100) COLLATE utf8_unicode_ci NOT NULL COMMENT 'password salt',
  `password_integrity` varchar(512) COLLATE utf8_unicode_ci NOT NULL COMMENT 'password integrity',
  `ip` varchar(100) COLLATE utf8_unicode_ci NOT NULL COMMENT 'user login request ip',
  `is_private` tinyint NOT NULL DEFAULT '1' COMMENT 'private user or not, 1: true, other: false',
  `scopes` json DEFAULT NULL COMMENT 'white scope list, ["@cnpm", "@foo"]',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_id` (`user_id`),
  UNIQUE KEY `uk_name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8_unicode_ci COMMENT='user info'
;


CREATE TABLE `webauthn_credentials` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `wanc_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'webauthn credential id',
  `user_id` varchar(24) COLLATE utf8_unicode_ci NOT NULL COMMENT 'user id',
  `credential_id` varchar(200) COLLATE utf8_unicode_ci NOT NULL COMMENT 'webauthn credential id',
  `public_key` varchar(512) COLLATE utf8_unicode_ci NOT NULL COMMENT 'webauthn credential publick key',
  `browser_type` varchar(20) COLLATE utf8_unicode_ci DEFAULT NULL COMMENT 'user browser name',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_wanc_id` (`wanc_id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8_unicode_ci COMMENT='webauthn credential info'
;
