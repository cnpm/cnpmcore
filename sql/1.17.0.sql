CREATE TABLE IF NOT EXISTS `proxy_mode_cached_files` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modify time',
  `target_name` varchar(214) NOT NULL COMMENT '@scope/package or @scope/package/version',
  `file_type` varchar(20) NOT NULL COMMENT 'file type',
  `file_path` varchar(512) NOT NULL COMMENT 'nfs file path',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_proxy_mode_file_path` (`file_path`),
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb3 COLLATE=utf8_unicode_ci COMMENT='proxy mode cached files';