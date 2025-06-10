ALTER TABLE `binaries` ADD INDEX `idx_category_parent_gmt_create` (`category`, `parent`, `gmt_create`);

ALTER TABLE `binaries` DROP INDEX `idx_category_parent`;
