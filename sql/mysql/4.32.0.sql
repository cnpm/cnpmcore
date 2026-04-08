ALTER TABLE `team_members` ADD COLUMN `role` varchar(20) NOT NULL DEFAULT 'member' COMMENT 'member role: owner or member' AFTER `user_id`;
