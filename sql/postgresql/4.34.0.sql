-- dependency isolation (buffer) zone: https://github.com/cnpm/cnpmcore/issues/1057
-- NOTE: this migration only adds nullable columns + an index; it does NOT change any behavior.
-- Behavior is gated by config `enableBlockPackageVersion` / `enableDependencyIsolation` (both
-- default off). ⚠️ Before turning `enableBlockPackageVersion` on, audit existing single-version
-- rows in this table: enabling it retroactively HIDES those versions (incl. audit-only records).
ALTER TABLE package_version_blocks ADD COLUMN type varchar(16) DEFAULT NULL;
ALTER TABLE package_version_blocks ADD COLUMN expired_at timestamp(3) DEFAULT NULL;
COMMENT ON COLUMN package_version_blocks.type IS 'block type: buffer = dependency isolation (auto-releasable), null = permanent';
COMMENT ON COLUMN package_version_blocks.expired_at IS 'dependency isolation buffer expiration time';
CREATE INDEX package_version_blocks_idx_type_expired_at ON package_version_blocks (type, expired_at);
