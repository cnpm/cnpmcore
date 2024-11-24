-- fix https://github.com/cnpm/cnpmcore/issues/343
UPDATE
	`registries`
SET
	`host` = 'https://registry.npmjs.org'
WHERE
	`name` = 'default'
	AND `host` = 'https://replicate.npmjs.com';
