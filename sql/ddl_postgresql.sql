CREATE TABLE binaries (
  id BIGSERIAL PRIMARY KEY,
  gmt_create timestamp(3) NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  binary_id varchar(24) NOT NULL,
  category varchar(50) NOT NULL,
  parent varchar(500) NOT NULL,
  name varchar(200) NOT NULL,
  is_dir boolean NOT NULL DEFAULT false,
  size integer NOT NULL,
  date varchar(100) NOT NULL
);

CREATE UNIQUE INDEX binaries_uk_binary_id ON binaries (binary_id);
CREATE UNIQUE INDEX binaries_uk_category_parent_name ON binaries (category, parent, name);
CREATE INDEX binaries_idx_category_parent ON binaries (category, parent);

COMMENT ON TABLE binaries IS 'binary info';
COMMENT ON COLUMN binaries.id IS 'primary key';
COMMENT ON COLUMN binaries.gmt_create IS 'create time';
COMMENT ON COLUMN binaries.gmt_modified IS 'modified time';
COMMENT ON COLUMN binaries.binary_id IS 'binary id';
COMMENT ON COLUMN binaries.category IS 'binary category, e.g.: node, sass';
COMMENT ON COLUMN binaries.parent IS 'binary parent name, e.g.: /, /v1.0.0/, /v1.0.0/docs/';
COMMENT ON COLUMN binaries.name IS 'binary name, dir should ends with /';
COMMENT ON COLUMN binaries.is_dir IS 'is dir or not, 1: true, other: false';
COMMENT ON COLUMN binaries.size IS 'file size';
COMMENT ON COLUMN binaries.date IS 'date display string';


CREATE TABLE changes (
  id BIGSERIAL PRIMARY KEY,
  gmt_create timestamp(3) NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  change_id varchar(24) NOT NULL,
  type varchar(50) NOT NULL,
  target_name varchar(214) NOT NULL,
  data json DEFAULT NULL
);

CREATE UNIQUE INDEX changes_uk_change_id ON changes (change_id);

COMMENT ON TABLE changes IS 'change info';
COMMENT ON COLUMN changes.id IS 'primary key';
COMMENT ON COLUMN changes.gmt_create IS 'create time';
COMMENT ON COLUMN changes.gmt_modified IS 'modified time';
COMMENT ON COLUMN changes.change_id IS 'change id';
COMMENT ON COLUMN changes.type IS 'change type';
COMMENT ON COLUMN changes.target_name IS 'target name, like package name / user name';
COMMENT ON COLUMN changes.data IS 'change params';


CREATE TABLE dists (
  id BIGSERIAL PRIMARY KEY,
  gmt_create timestamp(3) NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  dist_id varchar(24) NOT NULL,
  name varchar(428) NOT NULL,
  path varchar(767) NOT NULL,
  size integer NOT NULL,
  shasum varchar(512) NOT NULL,
  integrity varchar(512) NOT NULL
);

CREATE UNIQUE INDEX dists_uk_dist_id ON dists (dist_id);

COMMENT ON TABLE dists IS 'dist info';
COMMENT ON COLUMN dists.id IS 'primary key';
COMMENT ON COLUMN dists.gmt_create IS 'create time';
COMMENT ON COLUMN dists.gmt_modified IS 'modified time';
COMMENT ON COLUMN dists.dist_id IS 'dist id';
COMMENT ON COLUMN dists.name IS 'dist name, 2x size of package name';
COMMENT ON COLUMN dists.path IS 'access path';
COMMENT ON COLUMN dists.size IS 'file size';
COMMENT ON COLUMN dists.shasum IS 'dist shasum';
COMMENT ON COLUMN dists.integrity IS 'dist integrity';


CREATE TABLE history_tasks (
  id BIGSERIAL PRIMARY KEY,
  gmt_create timestamp(3) NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  task_id varchar(24) NOT NULL,
  type varchar(20) NOT NULL,
  state varchar(20) NOT NULL,
  target_name varchar(214) NOT NULL,
  author_id varchar(24) NOT NULL,
  author_ip varchar(100) NOT NULL,
  data json DEFAULT NULL,
  log_path varchar(512) NOT NULL,
  log_store_position varchar(10) NOT NULL,
  attempts integer DEFAULT 0,
  error text
);

CREATE UNIQUE INDEX history_tasks_uk_task_id ON history_tasks (task_id);

COMMENT ON TABLE history_tasks IS 'history task info';
COMMENT ON COLUMN history_tasks.id IS 'primary key';
COMMENT ON COLUMN history_tasks.gmt_create IS 'create time';
COMMENT ON COLUMN history_tasks.gmt_modified IS 'modified time';
COMMENT ON COLUMN history_tasks.task_id IS 'task id';
COMMENT ON COLUMN history_tasks.type IS 'task type';
COMMENT ON COLUMN history_tasks.state IS 'task state';
COMMENT ON COLUMN history_tasks.target_name IS 'target name, like package name / user name';
COMMENT ON COLUMN history_tasks.author_id IS 'create task user id';
COMMENT ON COLUMN history_tasks.author_ip IS 'create task user request ip';
COMMENT ON COLUMN history_tasks.data IS 'task params';
COMMENT ON COLUMN history_tasks.log_path IS 'access path';
COMMENT ON COLUMN history_tasks.log_store_position IS 'cloud store disk position';
COMMENT ON COLUMN history_tasks.attempts IS 'task execute attempts times';
COMMENT ON COLUMN history_tasks.error IS 'error description';


CREATE TABLE hooks (
  id BIGSERIAL PRIMARY KEY,
  gmt_create timestamp(3) NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  hook_id varchar(24) NOT NULL,
  type varchar(20) NOT NULL,
  name varchar(428) NOT NULL,
  owner_id varchar(24) NOT NULL,
  endpoint varchar(2048) NOT NULL,
  secret varchar(200) NOT NULL,
  latest_task_id varchar(24) DEFAULT NULL,
  enable boolean NOT NULL DEFAULT false
);

CREATE UNIQUE INDEX hooks_uk_type_name_owner_id ON hooks (type, name, owner_id);
CREATE INDEX hooks_idx_type_name_id ON hooks (type, name, id);

COMMENT ON TABLE hooks IS 'task info';
COMMENT ON COLUMN hooks.id IS 'primary key';
COMMENT ON COLUMN hooks.gmt_create IS 'create time';
COMMENT ON COLUMN hooks.gmt_modified IS 'modified time';
COMMENT ON COLUMN hooks.hook_id IS 'hook id';
COMMENT ON COLUMN hooks.type IS 'hook type, scope, name, owner';
COMMENT ON COLUMN hooks.name IS 'hook name';
COMMENT ON COLUMN hooks.owner_id IS 'hook owner id';
COMMENT ON COLUMN hooks.endpoint IS 'hook url';
COMMENT ON COLUMN hooks.secret IS 'sign secret';
COMMENT ON COLUMN hooks.latest_task_id IS 'latest task id';
COMMENT ON COLUMN hooks.enable IS 'hook is enable not, 1: true, other: false';


CREATE TABLE maintainers (
  id BIGSERIAL PRIMARY KEY,
  gmt_create timestamp NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  package_id varchar(24) NOT NULL,
  user_id varchar(24) NOT NULL
);

CREATE UNIQUE INDEX maintainers_uk_package_id_user_id ON maintainers (package_id, user_id);
CREATE INDEX maintainers_idx_package_id ON maintainers (package_id);
CREATE INDEX maintainers_idx_user_id ON maintainers (user_id);

COMMENT ON TABLE maintainers IS 'package maintainers';
COMMENT ON COLUMN maintainers.id IS 'primary key';
COMMENT ON COLUMN maintainers.gmt_create IS 'create time';
COMMENT ON COLUMN maintainers.gmt_modified IS 'modified time';
COMMENT ON COLUMN maintainers.package_id IS 'package id';
COMMENT ON COLUMN maintainers.user_id IS 'user id';


CREATE TABLE package_deps (
  id BIGSERIAL PRIMARY KEY,
  gmt_create timestamp(3) NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  package_version_id varchar(24) NOT NULL,
  package_dep_id varchar(24) NOT NULL,
  scope varchar(214) NOT NULL,
  name varchar(214) NOT NULL,
  spec varchar(100) NOT NULL
);

CREATE UNIQUE INDEX package_deps_uk_package_dep_id ON package_deps (package_dep_id);
CREATE UNIQUE INDEX package_deps_uk_package_version_id_scope_name ON package_deps (package_version_id, scope, name);

COMMENT ON TABLE package_deps IS 'package dependency info';
COMMENT ON COLUMN package_deps.id IS 'primary key';
COMMENT ON COLUMN package_deps.gmt_create IS 'create time';
COMMENT ON COLUMN package_deps.gmt_modified IS 'modified time';
COMMENT ON COLUMN package_deps.package_version_id IS 'package version id';
COMMENT ON COLUMN package_deps.package_dep_id IS 'package dep id';
COMMENT ON COLUMN package_deps.scope IS 'package scope';
COMMENT ON COLUMN package_deps.name IS 'package name';
COMMENT ON COLUMN package_deps.spec IS 'package dep spec';


CREATE TABLE package_tags (
  id BIGSERIAL PRIMARY KEY,
  gmt_create timestamp(3) NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  package_id varchar(24) NOT NULL,
  package_tag_id varchar(24) NOT NULL,
  tag varchar(214) NOT NULL,
  version varchar(256) NOT NULL
);

CREATE UNIQUE INDEX package_tags_uk_package_tag_id ON package_tags (package_tag_id);
CREATE UNIQUE INDEX package_tags_uk_package_tag ON package_tags (package_id, tag);

COMMENT ON TABLE package_tags IS 'package tag info';
COMMENT ON COLUMN package_tags.id IS 'primary key';
COMMENT ON COLUMN package_tags.gmt_create IS 'create time';
COMMENT ON COLUMN package_tags.gmt_modified IS 'modified time';
COMMENT ON COLUMN package_tags.package_id IS 'package id';
COMMENT ON COLUMN package_tags.package_tag_id IS 'package tag id';
COMMENT ON COLUMN package_tags.tag IS 'package tag';
COMMENT ON COLUMN package_tags.version IS 'package version';


CREATE TABLE package_version_blocks (
  id BIGSERIAL PRIMARY KEY,
  gmt_create timestamp(3) NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  package_version_block_id varchar(24) NOT NULL,
  package_id varchar(24) NOT NULL,
  version varchar(256) NOT NULL,
  reason text NOT NULL
);

CREATE UNIQUE INDEX package_version_blocks_uk_package_version_block_id ON package_version_blocks (package_version_block_id);
CREATE UNIQUE INDEX package_version_blocks_uk_name_version ON package_version_blocks (package_id, version);

COMMENT ON TABLE package_version_blocks IS 'blocklist package versions';
COMMENT ON COLUMN package_version_blocks.id IS 'primary key';
COMMENT ON COLUMN package_version_blocks.gmt_create IS 'create time';
COMMENT ON COLUMN package_version_blocks.gmt_modified IS 'modified time';
COMMENT ON COLUMN package_version_blocks.package_version_block_id IS 'package version block id';
COMMENT ON COLUMN package_version_blocks.package_id IS 'package id';
COMMENT ON COLUMN package_version_blocks.version IS 'package version, "*" meaning all versions';
COMMENT ON COLUMN package_version_blocks.reason IS 'block reason';


CREATE TABLE package_version_downloads (
  id BIGSERIAL PRIMARY KEY,
  gmt_create timestamp(3) NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  year_month integer NOT NULL,
  package_id varchar(214) NOT NULL,
  version varchar(256) NOT NULL,
  d01 integer NOT NULL DEFAULT 0,
  d02 integer NOT NULL DEFAULT 0,
  d03 integer NOT NULL DEFAULT 0,
  d04 integer NOT NULL DEFAULT 0,
  d05 integer NOT NULL DEFAULT 0,
  d06 integer NOT NULL DEFAULT 0,
  d07 integer NOT NULL DEFAULT 0,
  d08 integer NOT NULL DEFAULT 0,
  d09 integer NOT NULL DEFAULT 0,
  d10 integer NOT NULL DEFAULT 0,
  d11 integer NOT NULL DEFAULT 0,
  d12 integer NOT NULL DEFAULT 0,
  d13 integer NOT NULL DEFAULT 0,
  d14 integer NOT NULL DEFAULT 0,
  d15 integer NOT NULL DEFAULT 0,
  d16 integer NOT NULL DEFAULT 0,
  d17 integer NOT NULL DEFAULT 0,
  d18 integer NOT NULL DEFAULT 0,
  d19 integer NOT NULL DEFAULT 0,
  d20 integer NOT NULL DEFAULT 0,
  d21 integer NOT NULL DEFAULT 0,
  d22 integer NOT NULL DEFAULT 0,
  d23 integer NOT NULL DEFAULT 0,
  d24 integer NOT NULL DEFAULT 0,
  d25 integer NOT NULL DEFAULT 0,
  d26 integer NOT NULL DEFAULT 0,
  d27 integer NOT NULL DEFAULT 0,
  d28 integer NOT NULL DEFAULT 0,
  d29 integer NOT NULL DEFAULT 0,
  d30 integer NOT NULL DEFAULT 0,
  d31 integer NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX package_version_downloads_uk_year_month_package_id_version ON package_version_downloads (year_month, package_id, version);
CREATE INDEX package_version_downloads_idx_year_month ON package_version_downloads (year_month);
CREATE INDEX package_version_downloads_idx_packageid_yearmonth ON package_version_downloads (package_id, year_month);

COMMENT ON TABLE package_version_downloads IS 'package version download total info';
COMMENT ON COLUMN package_version_downloads.id IS 'primary key';
COMMENT ON COLUMN package_version_downloads.gmt_create IS 'create time';
COMMENT ON COLUMN package_version_downloads.gmt_modified IS 'modified time';
COMMENT ON COLUMN package_version_downloads.year_month IS 'YYYYMM format';
COMMENT ON COLUMN package_version_downloads.package_id IS 'package id, maybe scope name';
COMMENT ON COLUMN package_version_downloads.version IS 'package version';
COMMENT ON COLUMN package_version_downloads.d01 IS '01 download count';
COMMENT ON COLUMN package_version_downloads.d02 IS '02 download count';
COMMENT ON COLUMN package_version_downloads.d03 IS '03 download count';
COMMENT ON COLUMN package_version_downloads.d04 IS '04 download count';
COMMENT ON COLUMN package_version_downloads.d05 IS '05 download count';
COMMENT ON COLUMN package_version_downloads.d06 IS '06 download count';
COMMENT ON COLUMN package_version_downloads.d07 IS '07 download count';
COMMENT ON COLUMN package_version_downloads.d08 IS '08 download count';
COMMENT ON COLUMN package_version_downloads.d09 IS '09 download count';
COMMENT ON COLUMN package_version_downloads.d10 IS '10 download count';
COMMENT ON COLUMN package_version_downloads.d11 IS '11 download count';
COMMENT ON COLUMN package_version_downloads.d12 IS '12 download count';
COMMENT ON COLUMN package_version_downloads.d13 IS '13 download count';
COMMENT ON COLUMN package_version_downloads.d14 IS '14 download count';
COMMENT ON COLUMN package_version_downloads.d15 IS '15 download count';
COMMENT ON COLUMN package_version_downloads.d16 IS '16 download count';
COMMENT ON COLUMN package_version_downloads.d17 IS '17 download count';
COMMENT ON COLUMN package_version_downloads.d18 IS '18 download count';
COMMENT ON COLUMN package_version_downloads.d19 IS '19 download count';
COMMENT ON COLUMN package_version_downloads.d20 IS '20 download count';
COMMENT ON COLUMN package_version_downloads.d21 IS '21 download count';
COMMENT ON COLUMN package_version_downloads.d22 IS '22 download count';
COMMENT ON COLUMN package_version_downloads.d23 IS '23 download count';
COMMENT ON COLUMN package_version_downloads.d24 IS '24 download count';
COMMENT ON COLUMN package_version_downloads.d25 IS '25 download count';
COMMENT ON COLUMN package_version_downloads.d26 IS '26 download count';
COMMENT ON COLUMN package_version_downloads.d27 IS '27 download count';
COMMENT ON COLUMN package_version_downloads.d28 IS '28 download count';
COMMENT ON COLUMN package_version_downloads.d29 IS '29 download count';
COMMENT ON COLUMN package_version_downloads.d30 IS '30 download count';
COMMENT ON COLUMN package_version_downloads.d31 IS '31 download count';


CREATE TABLE package_version_files (
  id BIGSERIAL PRIMARY KEY,
  gmt_create timestamp(3) NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  package_version_id varchar(24) NOT NULL,
  package_version_file_id varchar(24) NOT NULL,
  dist_id varchar(24) NOT NULL,
  directory varchar(500) NOT NULL,
  name varchar(200) NOT NULL,
  content_type varchar(200) NOT NULL,
  mtime timestamp(3) NOT NULL
);

CREATE UNIQUE INDEX package_version_files_uk_package_version_file_id ON package_version_files (package_version_file_id);
CREATE UNIQUE INDEX package_version_files_ux_package_version_id_directory_name ON package_version_files (package_version_id, directory, name);

COMMENT ON TABLE package_version_files IS 'package version file';
COMMENT ON COLUMN package_version_files.id IS 'primary key';
COMMENT ON COLUMN package_version_files.gmt_create IS 'create time';
COMMENT ON COLUMN package_version_files.gmt_modified IS 'modified time';
COMMENT ON COLUMN package_version_files.package_version_id IS 'package version id';
COMMENT ON COLUMN package_version_files.package_version_file_id IS 'package version file id';
COMMENT ON COLUMN package_version_files.dist_id IS 'file dist id';
COMMENT ON COLUMN package_version_files.directory IS 'directory path, e.g.: /bin';
COMMENT ON COLUMN package_version_files.name IS 'file name, e.g.: index.js';
COMMENT ON COLUMN package_version_files.content_type IS 'file content type, e.g.: application/javascript';
COMMENT ON COLUMN package_version_files.mtime IS 'file modified time';


CREATE TABLE package_version_manifests (
  id BIGSERIAL PRIMARY KEY,
  gmt_create timestamp(3) NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  package_id varchar(24) NOT NULL,
  package_version_id varchar(24) NOT NULL,
  package_version_manifest_id varchar(24) NOT NULL,
  manifest json NOT NULL
);

CREATE UNIQUE INDEX package_version_manifests_uk_package_version_manifest_id ON package_version_manifests (package_version_manifest_id);
CREATE UNIQUE INDEX package_version_manifests_uk_package_version_id ON package_version_manifests (package_version_id);
CREATE INDEX package_version_manifests_idx_package_id ON package_version_manifests (package_id);

COMMENT ON TABLE package_version_manifests IS 'package version manifest';
COMMENT ON COLUMN package_version_manifests.id IS 'primary key';
COMMENT ON COLUMN package_version_manifests.gmt_create IS 'create time';
COMMENT ON COLUMN package_version_manifests.gmt_modified IS 'modified time';
COMMENT ON COLUMN package_version_manifests.package_id IS 'package id';
COMMENT ON COLUMN package_version_manifests.package_version_id IS 'package version id';
COMMENT ON COLUMN package_version_manifests.package_version_manifest_id IS 'package version manifest id';
COMMENT ON COLUMN package_version_manifests.manifest IS 'manifest JSON, including README text';


CREATE TABLE package_versions (
  id BIGSERIAL PRIMARY KEY,
  gmt_create timestamp(3) NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  package_id varchar(24) NOT NULL,
  package_version_id varchar(24) NOT NULL,
  version varchar(256) NOT NULL,
  abbreviated_dist_id varchar(24) NOT NULL,
  manifest_dist_id varchar(24) NOT NULL,
  tar_dist_id varchar(24) NOT NULL,
  readme_dist_id varchar(24) NOT NULL,
  publish_time timestamp(3) NOT NULL,
  padding_version varchar(255) DEFAULT NULL,
  is_pre_release boolean DEFAULT NULL
);

CREATE UNIQUE INDEX package_versions_uk_package_version_id ON package_versions (package_version_id);
CREATE UNIQUE INDEX package_versions_uk_package_id_version ON package_versions (package_id, version);
CREATE INDEX package_versions_idx_pkg_id_is_pre_release_padding_version ON package_versions (package_id, padding_version, is_pre_release, version);

COMMENT ON TABLE package_versions IS 'package version info';
COMMENT ON COLUMN package_versions.id IS 'primary key';
COMMENT ON COLUMN package_versions.gmt_create IS 'create time';
COMMENT ON COLUMN package_versions.gmt_modified IS 'modified time';
COMMENT ON COLUMN package_versions.package_id IS 'package id';
COMMENT ON COLUMN package_versions.package_version_id IS 'package version id';
COMMENT ON COLUMN package_versions.version IS 'package version';
COMMENT ON COLUMN package_versions.abbreviated_dist_id IS 'abbreviated manifest dist id';
COMMENT ON COLUMN package_versions.manifest_dist_id IS 'manifest dist id';
COMMENT ON COLUMN package_versions.tar_dist_id IS 'tar dist id';
COMMENT ON COLUMN package_versions.readme_dist_id IS 'readme dist id';
COMMENT ON COLUMN package_versions.publish_time IS 'publish time';
COMMENT ON COLUMN package_versions.padding_version IS 'token name';
COMMENT ON COLUMN package_versions.is_pre_release IS '是否是先行版本';


CREATE TABLE packages (
  id BIGSERIAL PRIMARY KEY,
  gmt_create timestamp(3) NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  package_id varchar(24) NOT NULL,
  is_private boolean NOT NULL DEFAULT false,
  name varchar(214) NOT NULL,
  scope varchar(214) NOT NULL,
  description varchar(10240) DEFAULT NULL,
  abbreviateds_dist_id varchar(24) DEFAULT NULL,
  manifests_dist_id varchar(24) DEFAULT NULL,
  registry_id varchar(24) DEFAULT NULL
);

CREATE UNIQUE INDEX packages_uk_package_id ON packages (package_id);
CREATE UNIQUE INDEX packages_uk_scope_name ON packages (scope, name);

COMMENT ON TABLE packages IS 'package info';
COMMENT ON COLUMN packages.id IS 'primary key';
COMMENT ON COLUMN packages.gmt_create IS 'create time';
COMMENT ON COLUMN packages.gmt_modified IS 'modified time';
COMMENT ON COLUMN packages.package_id IS 'package id';
COMMENT ON COLUMN packages.is_private IS 'private pkg or not, 1: true, other: false';
COMMENT ON COLUMN packages.name IS 'package name';
COMMENT ON COLUMN packages.scope IS 'package name, empty string meaning no scope';
COMMENT ON COLUMN packages.description IS 'package description';
COMMENT ON COLUMN packages.abbreviateds_dist_id IS 'all abbreviated manifests dist id';
COMMENT ON COLUMN packages.manifests_dist_id IS 'all full manifests dist id';
COMMENT ON COLUMN packages.registry_id IS 'source registry';


CREATE TABLE proxy_caches (
  id BIGSERIAL PRIMARY KEY,
  gmt_create timestamp(3) NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  fullname varchar(214) NOT NULL DEFAULT '',
  version varchar(214) DEFAULT NULL,
  file_type varchar(30) NOT NULL DEFAULT '',
  file_path varchar(512) NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX proxy_caches_uk_package_version_path_name ON proxy_caches (file_path);
CREATE UNIQUE INDEX proxy_caches_ux_package_version_file_name ON proxy_caches (fullname, file_type, version);

COMMENT ON TABLE proxy_caches IS 'proxy mode cached files index';
COMMENT ON COLUMN proxy_caches.id IS 'primary key';
COMMENT ON COLUMN proxy_caches.gmt_create IS 'create time';
COMMENT ON COLUMN proxy_caches.gmt_modified IS 'modify time';
COMMENT ON COLUMN proxy_caches.fullname IS '@scope/package name';
COMMENT ON COLUMN proxy_caches.version IS 'package version';
COMMENT ON COLUMN proxy_caches.file_type IS 'file type';
COMMENT ON COLUMN proxy_caches.file_path IS 'nfs file path';


CREATE TABLE registries (
  id BIGSERIAL PRIMARY KEY,
  gmt_create timestamp(3) NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  registry_id varchar(24) NOT NULL,
  name varchar(256) DEFAULT NULL,
  host varchar(4096) DEFAULT NULL,
  change_stream varchar(4096) DEFAULT NULL,
  type varchar(256) DEFAULT NULL,
  user_prefix varchar(256) DEFAULT NULL,
  auth_token varchar(256) DEFAULT NULL
);

CREATE UNIQUE INDEX registries_uk_name ON registries (name);

COMMENT ON TABLE registries IS 'registry info';
COMMENT ON COLUMN registries.id IS 'primary key';
COMMENT ON COLUMN registries.gmt_create IS 'create time';
COMMENT ON COLUMN registries.gmt_modified IS 'modified time';
COMMENT ON COLUMN registries.registry_id IS 'registry id';
COMMENT ON COLUMN registries.name IS 'registry name';
COMMENT ON COLUMN registries.host IS 'registry host';
COMMENT ON COLUMN registries.change_stream IS 'change stream url';
COMMENT ON COLUMN registries.type IS 'registry type cnpmjsorg/cnpmcore/npm';
COMMENT ON COLUMN registries.user_prefix IS 'user prefix';
COMMENT ON COLUMN registries.auth_token IS 'registry auth token';


CREATE TABLE scopes (
  id BIGSERIAL PRIMARY KEY,
  gmt_create timestamp(3) NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  scope_id varchar(24) NOT NULL,
  name varchar(214) DEFAULT NULL,
  registry_id varchar(24) NOT NULL
);

CREATE UNIQUE INDEX scopes_uk_name ON scopes (name);

COMMENT ON TABLE scopes IS 'scope info';
COMMENT ON COLUMN scopes.id IS 'primary key';
COMMENT ON COLUMN scopes.gmt_create IS 'create time';
COMMENT ON COLUMN scopes.gmt_modified IS 'modified time';
COMMENT ON COLUMN scopes.scope_id IS 'scope id';
COMMENT ON COLUMN scopes.name IS 'scope name';
COMMENT ON COLUMN scopes.registry_id IS 'registry id';


CREATE TABLE tasks (
  id BIGSERIAL PRIMARY KEY,
  gmt_create timestamp(3) NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  task_id varchar(24) NOT NULL,
  type varchar(20) NOT NULL,
  state varchar(20) NOT NULL,
  target_name varchar(214) NOT NULL,
  author_id varchar(24) NOT NULL,
  author_ip varchar(100) NOT NULL,
  data json DEFAULT NULL,
  log_path varchar(512) NOT NULL,
  log_store_position varchar(10) NOT NULL,
  attempts integer DEFAULT 0,
  error text,
  biz_id varchar(100) DEFAULT NULL
);

CREATE UNIQUE INDEX tasks_uk_task_id ON tasks (task_id);
CREATE UNIQUE INDEX tasks_uk_biz_id ON tasks (biz_id);
CREATE INDEX tasks_idx_type_state_target_name ON tasks (target_name, type, state);
CREATE INDEX tasks_idx_type_state_gmt_modified ON tasks (type, state, gmt_modified);
CREATE INDEX tasks_idx_gmt_modified ON tasks (gmt_modified);

COMMENT ON TABLE tasks IS 'task info';
COMMENT ON COLUMN tasks.id IS 'primary key';
COMMENT ON COLUMN tasks.gmt_create IS 'create time';
COMMENT ON COLUMN tasks.gmt_modified IS 'modified time';
COMMENT ON COLUMN tasks.task_id IS 'task id';
COMMENT ON COLUMN tasks.type IS 'task type';
COMMENT ON COLUMN tasks.state IS 'task state';
COMMENT ON COLUMN tasks.target_name IS 'target name, like package name / user name';
COMMENT ON COLUMN tasks.author_id IS 'create task user id';
COMMENT ON COLUMN tasks.author_ip IS 'create task user request ip';
COMMENT ON COLUMN tasks.data IS 'task params';
COMMENT ON COLUMN tasks.log_path IS 'access path';
COMMENT ON COLUMN tasks.log_store_position IS 'cloud store disk position';
COMMENT ON COLUMN tasks.attempts IS 'task execute attempts times';
COMMENT ON COLUMN tasks.error IS 'error description';
COMMENT ON COLUMN tasks.biz_id IS 'unique biz id to keep task unique';


CREATE TABLE token_packages (
  id BIGSERIAL PRIMARY KEY,
  gmt_create timestamp(3) NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  token_id varchar(24) NOT NULL,
  package_id varchar(24) NOT NULL
);

CREATE UNIQUE INDEX token_packages_uk_token_id_package_id ON token_packages (token_id, package_id);
CREATE INDEX token_packages_idx_token_id ON token_packages (token_id);
CREATE INDEX token_packages_idx_package_id ON token_packages (package_id);

COMMENT ON TABLE token_packages IS 'token allowed packages';
COMMENT ON COLUMN token_packages.id IS 'primary key';
COMMENT ON COLUMN token_packages.gmt_create IS 'create time';
COMMENT ON COLUMN token_packages.gmt_modified IS 'modified time';
COMMENT ON COLUMN token_packages.token_id IS 'token id';
COMMENT ON COLUMN token_packages.package_id IS 'package id';


CREATE TABLE tokens (
  id BIGSERIAL PRIMARY KEY,
  gmt_create timestamp(3) NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  token_id varchar(24) NOT NULL,
  token_mark varchar(20) NOT NULL,
  token_key varchar(200) NOT NULL,
  is_readonly boolean NOT NULL DEFAULT false,
  is_automation boolean NOT NULL DEFAULT false,
  cidr_whitelist json NOT NULL,
  user_id varchar(24) NOT NULL,
  name varchar(255) DEFAULT NULL,
  type varchar(255) DEFAULT NULL,
  description varchar(255) DEFAULT NULL,
  allowed_scopes text,
  expired_at timestamp(3) DEFAULT NULL,
  last_used_at timestamp(3) DEFAULT NULL
);

CREATE UNIQUE INDEX tokens_uk_token_id ON tokens (token_id);
CREATE UNIQUE INDEX tokens_uk_token_key ON tokens (token_key);
CREATE UNIQUE INDEX tokens_uk_user_id_name ON tokens (user_id, name);
CREATE INDEX tokens_idx_user_id ON tokens (user_id);

COMMENT ON TABLE tokens IS 'token info';
COMMENT ON COLUMN tokens.id IS 'primary key';
COMMENT ON COLUMN tokens.gmt_create IS 'create time';
COMMENT ON COLUMN tokens.gmt_modified IS 'modified time';
COMMENT ON COLUMN tokens.token_id IS 'token id';
COMMENT ON COLUMN tokens.token_mark IS 'token mark value';
COMMENT ON COLUMN tokens.token_key IS 'token value sha512 hex';
COMMENT ON COLUMN tokens.is_readonly IS 'readonly token or not, 1: true, other: false';
COMMENT ON COLUMN tokens.is_automation IS 'automation token or not, 1: true, other: false';
COMMENT ON COLUMN tokens.cidr_whitelist IS 'ip list, ["127.0.0.1"]';
COMMENT ON COLUMN tokens.user_id IS 'user id';
COMMENT ON COLUMN tokens.name IS 'token name';
COMMENT ON COLUMN tokens.type IS 'token type, granular or legacy';
COMMENT ON COLUMN tokens.description IS 'token description';
COMMENT ON COLUMN tokens.allowed_scopes IS 'scope allowed list';
COMMENT ON COLUMN tokens.expired_at IS 'token expiration time';
COMMENT ON COLUMN tokens.last_used_at IS 'token last used time';


CREATE TABLE total (
  id BIGSERIAL PRIMARY KEY,
  total_id varchar(24) NOT NULL,
  gmt_create timestamp(3) NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  package_count bigint NOT NULL DEFAULT 0,
  package_file_size bigint NOT NULL DEFAULT 0,
  package_version_count bigint NOT NULL DEFAULT 0,
  package_version_delete_count bigint NOT NULL DEFAULT 0,
  private_package_count bigint NOT NULL DEFAULT 0,
  private_package_file_size bigint NOT NULL DEFAULT 0,
  private_package_version_count bigint NOT NULL DEFAULT 0,
  private_package_version_delete_count bigint NOT NULL DEFAULT 0,
  change_stream_seq varchar(100) DEFAULT NULL
);

CREATE UNIQUE INDEX total_uk_total_id ON total (total_id);

COMMENT ON TABLE total IS 'total info';
COMMENT ON COLUMN total.id IS 'primary key';
COMMENT ON COLUMN total.total_id IS 'total id, should set it to "global"';
COMMENT ON COLUMN total.gmt_create IS 'create time';
COMMENT ON COLUMN total.gmt_modified IS 'modified time';
COMMENT ON COLUMN total.package_count IS 'package count';
COMMENT ON COLUMN total.package_file_size IS 'package all files total size';
COMMENT ON COLUMN total.package_version_count IS 'package version count';
COMMENT ON COLUMN total.package_version_delete_count IS 'package version delete count';
COMMENT ON COLUMN total.private_package_count IS 'private package count';
COMMENT ON COLUMN total.private_package_file_size IS 'private package all files total size';
COMMENT ON COLUMN total.private_package_version_count IS 'private package version count';
COMMENT ON COLUMN total.private_package_version_delete_count IS 'private package version delete count';
COMMENT ON COLUMN total.change_stream_seq IS 'npm change stream sync data seq id';


CREATE TABLE users (
  id BIGSERIAL PRIMARY KEY,
  gmt_create timestamp(3) NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  user_id varchar(24) NOT NULL,
  name varchar(100) NOT NULL,
  email varchar(400) NOT NULL,
  password_salt varchar(100) NOT NULL,
  password_integrity varchar(512) NOT NULL,
  ip varchar(100) NOT NULL,
  is_private boolean NOT NULL DEFAULT true,
  scopes json DEFAULT NULL
);

CREATE UNIQUE INDEX users_uk_user_id ON users (user_id);
CREATE UNIQUE INDEX users_uk_name ON users (name);

COMMENT ON TABLE users IS 'user info';
COMMENT ON COLUMN users.id IS 'primary key';
COMMENT ON COLUMN users.gmt_create IS 'create time';
COMMENT ON COLUMN users.gmt_modified IS 'modified time';
COMMENT ON COLUMN users.user_id IS 'user id';
COMMENT ON COLUMN users.name IS 'user name';
COMMENT ON COLUMN users.email IS 'user email';
COMMENT ON COLUMN users.password_salt IS 'password salt';
COMMENT ON COLUMN users.password_integrity IS 'password integrity';
COMMENT ON COLUMN users.ip IS 'user login request ip';
COMMENT ON COLUMN users.is_private IS 'private user or not, 1: true, other: false';
COMMENT ON COLUMN users.scopes IS 'white scope list, ["@cnpm", "@foo"]';


CREATE TABLE webauthn_credentials (
  id BIGSERIAL PRIMARY KEY,
  gmt_create timestamp(3) NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  wanc_id varchar(24) NOT NULL,
  user_id varchar(24) NOT NULL,
  credential_id varchar(200) NOT NULL,
  public_key varchar(512) NOT NULL,
  browser_type varchar(20) DEFAULT NULL
);

CREATE UNIQUE INDEX webauthn_credentials_uk_wanc_id ON webauthn_credentials (wanc_id);
CREATE INDEX webauthn_credentials_idx_user_id ON webauthn_credentials (user_id);

COMMENT ON TABLE webauthn_credentials IS 'webauthn credential info';
COMMENT ON COLUMN webauthn_credentials.id IS 'primary key';
COMMENT ON COLUMN webauthn_credentials.gmt_create IS 'create time';
COMMENT ON COLUMN webauthn_credentials.gmt_modified IS 'modified time';
COMMENT ON COLUMN webauthn_credentials.wanc_id IS 'webauthn credential id';
COMMENT ON COLUMN webauthn_credentials.user_id IS 'user id';
COMMENT ON COLUMN webauthn_credentials.credential_id IS 'webauthn credential id';
COMMENT ON COLUMN webauthn_credentials.public_key IS 'webauthn credential publick key';
COMMENT ON COLUMN webauthn_credentials.browser_type IS 'user browser name';
