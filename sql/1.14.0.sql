ALTER TABLE `tokens` ADD COLUMN `name` varchar(255) NULL COMMENT 'token name';
ALTER TABLE `tokens` ADD COLUMN `type` varchar(255) NULL COMMENT 'token type, granular or legacy';
ALTER TABLE `tokens` ADD COLUMN `description` varchar(255) NULL COMMENT 'token description';
ALTER TABLE `tokens` ADD COLUMN `allowed_packages` varchar(12750) NULL COMMENT 'package whitelist associated with token';
ALTER TABLE `tokens` ADD COLUMN `allowed_scopes` varchar(12750) NULL COMMENT 'scope whitelist associated with token';
ALTER TABLE `tokens` ADD COLUMN `expires` int unsigned NULL COMMENT 'token expiration time, in days.';
ALTER TABLE `tokens` ADD UNIQUE KEY `uk_user_name` (`user_id`, `name`);
