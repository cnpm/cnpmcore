CREATE TABLE IF NOT EXISTS totals (
  id SERIAL PRIMARY KEY,
  type varchar(24) NOT NULL,
  count bigint NOT NULL,
  gmt_create timestamp NOT NULL,
  gmt_modified timestamp NOT NULL,
  CONSTRAINT uk_type UNIQUE (type)
);

-- init data
INSERT INTO totals (type, count, gmt_create, gmt_modified)
SELECT 'packageCount', COUNT(*), NOW(), NOW() FROM packages
UNION ALL
SELECT 'packageVersionCount', COUNT(*), NOW(), NOW() FROM package_versions;
