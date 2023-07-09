CREATE TABLE IF NOT EXISTS `proxy_mode_cached_files` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modify time',
  `target_name` varchar(214) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci NOT NULL DEFAULT '' COMMENT '@scope/package name',
  `file_type` varchar(20) NOT NULL DEFAULT '' COMMENT 'file type',
  `file_path` varchar(512) NOT NULL DEFAULT '' COMMENT 'nfs file path',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3;