CREATE TABLE IF NOT EXISTS `totals` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `type` varchar(24) NOT NULL COMMENT 'total type',
  `count` bigint(20) NOT NULL COMMENT 'total count',
  `gmt_create` datetime NOT NULL COMMENT 'create time',
  `gmt_modified` datetime NOT NULL COMMENT 'modified time',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='total table';

-- init data
INSERT INTO `totals` (`type`, `count`, `gmt_create`, `gmt_modified`)
SELECT 'packageCount', COUNT(*), NOW(), NOW() FROM `packages`
UNION ALL
SELECT 'packageVersionCount', COUNT(*), NOW(), NOW() FROM `package_versions`;
