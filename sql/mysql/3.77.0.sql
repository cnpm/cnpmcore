CREATE TABLE IF NOT EXISTS `orgs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modify time',
  `org_id` varchar(24) NOT NULL COMMENT 'org id',
  `name` varchar(214) NOT NULL COMMENT 'org name, corresponds to scope without @',
  `description` varchar(10240) DEFAULT NULL COMMENT 'org description',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_org_id` (`org_id`),
  UNIQUE KEY `uk_name` (`name`)
) ENGINE=InnoDB DEFAULT COLLATE utf8mb3_unicode_ci CHARSET=utf8mb3 COMMENT 'organizations';

CREATE TABLE IF NOT EXISTS `org_members` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modify time',
  `org_member_id` varchar(24) NOT NULL COMMENT 'org member id',
  `org_id` varchar(24) NOT NULL COMMENT 'org id',
  `user_id` varchar(24) NOT NULL COMMENT 'user id',
  `role` varchar(20) NOT NULL DEFAULT 'member' COMMENT 'member role: owner or member',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_org_member_id` (`org_member_id`),
  UNIQUE KEY `uk_org_id_user_id` (`org_id`, `user_id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT COLLATE utf8mb3_unicode_ci CHARSET=utf8mb3 COMMENT 'organization members';

CREATE TABLE IF NOT EXISTS `teams` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modify time',
  `team_id` varchar(24) NOT NULL COMMENT 'team id',
  `org_id` varchar(24) NOT NULL COMMENT 'org id',
  `name` varchar(214) NOT NULL COMMENT 'team name',
  `description` varchar(10240) DEFAULT NULL COMMENT 'team description',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_team_id` (`team_id`),
  UNIQUE KEY `uk_org_id_name` (`org_id`, `name`),
  KEY `idx_org_id` (`org_id`)
) ENGINE=InnoDB DEFAULT COLLATE utf8mb3_unicode_ci CHARSET=utf8mb3 COMMENT 'teams within organizations';

CREATE TABLE IF NOT EXISTS `team_members` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modify time',
  `team_member_id` varchar(24) NOT NULL COMMENT 'team member id',
  `team_id` varchar(24) NOT NULL COMMENT 'team id',
  `user_id` varchar(24) NOT NULL COMMENT 'user id',
  `role` varchar(20) NOT NULL DEFAULT 'member' COMMENT 'member role: owner or member',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_team_member_id` (`team_member_id`),
  UNIQUE KEY `uk_team_id_user_id` (`team_id`, `user_id`),
  KEY `idx_user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT COLLATE utf8mb3_unicode_ci CHARSET=utf8mb3 COMMENT 'team members';

CREATE TABLE IF NOT EXISTS `team_packages` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT COMMENT 'primary key',
  `gmt_create` datetime(3) NOT NULL COMMENT 'create time',
  `gmt_modified` datetime(3) NOT NULL COMMENT 'modify time',
  `team_package_id` varchar(24) NOT NULL COMMENT 'team package id',
  `team_id` varchar(24) NOT NULL COMMENT 'team id',
  `package_id` varchar(24) NOT NULL COMMENT 'package id',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_team_package_id` (`team_package_id`),
  UNIQUE KEY `uk_team_id_package_id` (`team_id`, `package_id`),
  KEY `idx_package_id` (`package_id`)
) ENGINE=InnoDB DEFAULT COLLATE utf8mb3_unicode_ci CHARSET=utf8mb3 COMMENT 'team package access grants';
