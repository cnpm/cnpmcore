ALTER TABLE `users` ADD COLUMN `wan_c_public_key` text NULL COMMENT 'webauthn credential publick key';
ALTER TABLE `users` ADD COLUMN `wan_c_id` text NULL COMMENT 'webauthn credential id';