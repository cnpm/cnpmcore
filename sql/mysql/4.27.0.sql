ALTER TABLE `users` ADD COLUMN `fullname` varchar(200) DEFAULT NULL COMMENT 'user fullname' AFTER `scopes`;
ALTER TABLE `users` ADD COLUMN `homepage` varchar(400) DEFAULT NULL COMMENT 'user homepage url' AFTER `fullname`;
ALTER TABLE `users` ADD COLUMN `twitter` varchar(100) DEFAULT NULL COMMENT 'user twitter handle' AFTER `homepage`;
ALTER TABLE `users` ADD COLUMN `github` varchar(100) DEFAULT NULL COMMENT 'user github handle' AFTER `twitter`;
ALTER TABLE `users` ADD COLUMN `freenode` varchar(100) DEFAULT NULL COMMENT 'user freenode handle' AFTER `github`;
