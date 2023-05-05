CREATE TABLE IF NOT EXISTS `package_version_files` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modified time',
  `package_version_id` varchar(24) NOT NULL COMMENT 'package version id',
  `package_version_file_id` varchar(24) NOT NULL COMMENT 'package version file id',
  `dist_id` varchar(24) NOT NULL COMMENT 'file dist id',
  `directory` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'directory path, e.g.: /bin',
  `name` varchar(200) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT 'file name, e.g.: index.js',
  `content_type` varchar(200) NOT NULL COMMENT 'file content type, e.g.: application/javascript',
  `mtime` datetime(3) NOT NULL COMMENT 'file modified time',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_package_version_file_id` (`package_version_file_id`),
  UNIQUE KEY `ux_package_version_id_directory_name` (`package_version_id`, `directory`, `name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci COMMENT='package version file';
