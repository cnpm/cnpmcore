CREATE TABLE IF NOT EXISTS totals (
  id SERIAL PRIMARY KEY,
  type varchar(24) NOT NULL,
  count bigint NOT NULL,
  gmt_create timestamp NOT NULL,
  gmt_modified timestamp NOT NULL,
  CONSTRAINT uk_type UNIQUE (type)
);

COMMENT ON TABLE totals IS 'total table';
COMMENT ON COLUMN totals.id IS 'primary key';
COMMENT ON COLUMN totals.type IS 'total type';
COMMENT ON COLUMN totals.count IS 'total count';
COMMENT ON COLUMN totals.gmt_create IS 'create time';
COMMENT ON COLUMN totals.gmt_modified IS 'modified time';

INSERT INTO totals (type, count, gmt_create, gmt_modified)
SELECT 'packageCount', COUNT(*), NOW(), NOW() FROM packages
UNION ALL
SELECT 'packageVersionCount', COUNT(*), NOW(), NOW() FROM package_versions;
