CREATE TABLE IF NOT EXISTS `packages` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime NOT NULL COMMENT 'create time',
  `gmt_modified` datetime NOT NULL COMMENT 'modified time',
  `package_id` varchar(24) NOT NULL COMMENT 'package id',
  `is_private` tinyint NOT NULL DEFAULT 0 COMMENT 'private pkg or not, 1: true, other: false',
  `name` varchar(214) NOT NULL COMMENT 'module name',
  `scope` varchar(214) NULL COMMENT 'module name',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_package_id` (`package_id`),
  UNIQUE KEY `uk_scope_name` (`scope`,`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='package info';

CREATE TABLE IF NOT EXISTS `package_versions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime NOT NULL COMMENT 'create time',
  `gmt_modified` datetime NOT NULL COMMENT 'modified time',
  `package_id` varchar(24) NOT NULL COMMENT 'package id',
  `package_version_id` varchar(24) NOT NULL COMMENT 'package version id',
  `version` varchar(30) NOT NULL COMMENT 'package version',
  `manifest_dist_id` varchar(24) NOT NULL COMMENT 'manifest dist id',
  `tar_dist_id` varchar(24) NOT NULL COMMENT 'tar dist id',
  `readme_dist_id` varchar(24) NOT NULL COMMENT 'readme dist id',
  `publish_time` datetime NOT NULL COMMENT 'publish time',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_package_version_id` (`package_version_id`),
  UNIQUE KEY `uk_package_id_version` (`package_id`, `version`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='package version info';

CREATE TABLE IF NOT EXISTS `package_deps` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime NOT NULL COMMENT 'create time',
  `gmt_modified` datetime NOT NULL COMMENT 'modified time',
  `package_version_id` varchar(24) NOT NULL COMMENT 'package version id',
  `package_dep_id` varchar(24) NOT NULL COMMENT 'package dep id',
  `scope` varchar(214) NOT NULL COMMENT 'package scope',
  `name` varchar(214) NOT NULL COMMENT 'package name',
  `spec` varchar(100) NOT NULL COMMENT 'package dep spec',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_package_dep_id` (`package_dep_id`),
  UNIQUE KEY `uk_package_version_id_scope_name` (`package_version_id`, `scope`, `name`)
);

CREATE TABLE IF NOT EXISTS `dists` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime NOT NULL COMMENT 'create time',
  `gmt_modified` datetime NOT NULL COMMENT 'modified time',
  `dist_id` varchar(24) NOT NULL COMMENT 'dist id',
  `name` varchar(100) NOT NULL COMMENT 'dist name',
  `path` varchar(512) NOT NULL COMMENT 'access path',
  `size` int(10) unsigned NOT NULL COMMENT 'file size',
  `shasum` varchar(512) NOT NULL COMMENT 'dist shasum',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_dist_id` (`dist_id`),
  UNIQUE KEY `uk_path` (`path`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='dist info';

CREATE TABLE IF NOT EXISTS `upstream_changes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime NOT NULL COMMENT 'create time',
  `gmt_modified` datetime NOT NULL COMMENT 'modified time',
  `upstream_change_id` varchar(24) NOT NULL COMMENT 'upstream change id',
  `name` varchar(214) NOT NULL COMMENT 'module name',
  `seq` bigint(20) unsigned NOT NULL COMMENT 'seq id',
  `changes` text COMMENT 'changes json data',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_upstream_change_id` (`upstream_change_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='upstream change info';
