-- dependency isolation (buffer) zone: https://github.com/cnpm/cnpmcore/issues/1057
-- NOTE: this migration only adds nullable columns + an index; it does NOT change any behavior.
-- Behavior is gated by config `enableBlockPackageVersion` / `enableDependencyIsolation` (both
-- default off). ⚠️ Before turning `enableBlockPackageVersion` on, audit existing single-version
-- rows in this table: enabling it retroactively HIDES those versions (incl. audit-only records).
ALTER TABLE `package_version_blocks`
  ADD COLUMN `type` varchar(16) NULL COMMENT 'block type: buffer = dependency isolation (auto-releasable), null = permanent' AFTER `reason`,
  ADD COLUMN `expired_at` datetime(3) NULL COMMENT 'dependency isolation buffer expiration time' AFTER `type`,
  ADD KEY `idx_type_expired_at` (`type`, `expired_at`);
