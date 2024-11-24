ALTER TABLE
  `package_versions`
  ADD
    COLUMN padding_version varchar(255) DEFAULT NULL COMMENT 'token name',
  ADD
    COLUMN `is_pre_release` tinyint(4) DEFAULT NULL COMMENT 'pre release version or not',
  ADD
    KEY `idx_pkg_id_is_pre_release_padding_version` (`package_id`, `padding_version`, `is_pre_release`, `version`);
