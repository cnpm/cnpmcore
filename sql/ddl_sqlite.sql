-- SQLite DDL for cnpmcore
-- This schema is equivalent to ddl_mysql.sql adapted for SQLite

CREATE TABLE IF NOT EXISTS binaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmt_create DATETIME NOT NULL,
  gmt_modified DATETIME NOT NULL,
  binary_id TEXT NOT NULL,
  category TEXT NOT NULL,
  parent TEXT NOT NULL,
  name TEXT NOT NULL,
  is_dir INTEGER NOT NULL DEFAULT 0,
  size INTEGER NOT NULL,
  date TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS binaries_uk_binary_id ON binaries (binary_id);
CREATE UNIQUE INDEX IF NOT EXISTS binaries_uk_category_parent_name ON binaries (category, parent, name);
CREATE INDEX IF NOT EXISTS binaries_idx_category_parent_gmt_create ON binaries (category, parent, gmt_create);
CREATE INDEX IF NOT EXISTS binaries_idx_category_parent_date ON binaries (category, parent, date);


CREATE TABLE IF NOT EXISTS changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmt_create DATETIME NOT NULL,
  gmt_modified DATETIME NOT NULL,
  change_id TEXT NOT NULL,
  type TEXT NOT NULL,
  target_name TEXT NOT NULL,
  data TEXT DEFAULT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS changes_uk_change_id ON changes (change_id);


CREATE TABLE IF NOT EXISTS dists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmt_create DATETIME NOT NULL,
  gmt_modified DATETIME NOT NULL,
  dist_id TEXT NOT NULL,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  size INTEGER NOT NULL,
  shasum TEXT NOT NULL,
  integrity TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS dists_uk_dist_id ON dists (dist_id);


CREATE TABLE IF NOT EXISTS history_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmt_create DATETIME NOT NULL,
  gmt_modified DATETIME NOT NULL,
  task_id TEXT NOT NULL,
  type TEXT NOT NULL,
  state TEXT NOT NULL,
  target_name TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_ip TEXT NOT NULL,
  data TEXT DEFAULT NULL,
  log_path TEXT NOT NULL,
  log_store_position TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  error TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS history_tasks_uk_task_id ON history_tasks (task_id);


CREATE TABLE IF NOT EXISTS hooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmt_create DATETIME NOT NULL,
  gmt_modified DATETIME NOT NULL,
  hook_id TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  secret TEXT NOT NULL,
  latest_task_id TEXT DEFAULT NULL,
  enable INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS hooks_uk_type_name_owner_id ON hooks (type, name, owner_id);
CREATE INDEX IF NOT EXISTS hooks_idx_type_name_id ON hooks (type, name, id);


CREATE TABLE IF NOT EXISTS maintainers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmt_create DATETIME NOT NULL,
  gmt_modified DATETIME NOT NULL,
  package_id TEXT NOT NULL,
  user_id TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS maintainers_uk_package_id_user_id ON maintainers (package_id, user_id);
CREATE INDEX IF NOT EXISTS maintainers_idx_package_id ON maintainers (package_id);
CREATE INDEX IF NOT EXISTS maintainers_idx_user_id ON maintainers (user_id);


CREATE TABLE IF NOT EXISTS package_deps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmt_create DATETIME NOT NULL,
  gmt_modified DATETIME NOT NULL,
  package_version_id TEXT NOT NULL,
  package_dep_id TEXT NOT NULL,
  scope TEXT NOT NULL,
  name TEXT NOT NULL,
  spec TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS package_deps_uk_package_dep_id ON package_deps (package_dep_id);
CREATE UNIQUE INDEX IF NOT EXISTS package_deps_uk_package_version_id_scope_name ON package_deps (package_version_id, scope, name);


CREATE TABLE IF NOT EXISTS package_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmt_create DATETIME NOT NULL,
  gmt_modified DATETIME NOT NULL,
  package_id TEXT NOT NULL,
  package_tag_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  version TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS package_tags_uk_package_tag_id ON package_tags (package_tag_id);
CREATE UNIQUE INDEX IF NOT EXISTS package_tags_uk_package_tag ON package_tags (package_id, tag);


CREATE TABLE IF NOT EXISTS package_version_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmt_create DATETIME NOT NULL,
  gmt_modified DATETIME NOT NULL,
  package_version_block_id TEXT NOT NULL,
  package_id TEXT NOT NULL,
  version TEXT NOT NULL,
  reason TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS package_version_blocks_uk_package_version_block_id ON package_version_blocks (package_version_block_id);
CREATE UNIQUE INDEX IF NOT EXISTS package_version_blocks_uk_name_version ON package_version_blocks (package_id, version);


CREATE TABLE IF NOT EXISTS package_version_downloads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmt_create DATETIME NOT NULL,
  gmt_modified DATETIME NOT NULL,
  year_month INTEGER NOT NULL,
  package_id TEXT NOT NULL,
  version TEXT NOT NULL,
  d01 INTEGER NOT NULL DEFAULT 0,
  d02 INTEGER NOT NULL DEFAULT 0,
  d03 INTEGER NOT NULL DEFAULT 0,
  d04 INTEGER NOT NULL DEFAULT 0,
  d05 INTEGER NOT NULL DEFAULT 0,
  d06 INTEGER NOT NULL DEFAULT 0,
  d07 INTEGER NOT NULL DEFAULT 0,
  d08 INTEGER NOT NULL DEFAULT 0,
  d09 INTEGER NOT NULL DEFAULT 0,
  d10 INTEGER NOT NULL DEFAULT 0,
  d11 INTEGER NOT NULL DEFAULT 0,
  d12 INTEGER NOT NULL DEFAULT 0,
  d13 INTEGER NOT NULL DEFAULT 0,
  d14 INTEGER NOT NULL DEFAULT 0,
  d15 INTEGER NOT NULL DEFAULT 0,
  d16 INTEGER NOT NULL DEFAULT 0,
  d17 INTEGER NOT NULL DEFAULT 0,
  d18 INTEGER NOT NULL DEFAULT 0,
  d19 INTEGER NOT NULL DEFAULT 0,
  d20 INTEGER NOT NULL DEFAULT 0,
  d21 INTEGER NOT NULL DEFAULT 0,
  d22 INTEGER NOT NULL DEFAULT 0,
  d23 INTEGER NOT NULL DEFAULT 0,
  d24 INTEGER NOT NULL DEFAULT 0,
  d25 INTEGER NOT NULL DEFAULT 0,
  d26 INTEGER NOT NULL DEFAULT 0,
  d27 INTEGER NOT NULL DEFAULT 0,
  d28 INTEGER NOT NULL DEFAULT 0,
  d29 INTEGER NOT NULL DEFAULT 0,
  d30 INTEGER NOT NULL DEFAULT 0,
  d31 INTEGER NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS package_version_downloads_uk_year_month_package_id_version ON package_version_downloads (year_month, package_id, version);
CREATE INDEX IF NOT EXISTS package_version_downloads_idx_year_month ON package_version_downloads (year_month);
CREATE INDEX IF NOT EXISTS package_version_downloads_idx_packageid_yearmonth ON package_version_downloads (package_id, year_month);


CREATE TABLE IF NOT EXISTS package_version_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmt_create DATETIME NOT NULL,
  gmt_modified DATETIME NOT NULL,
  package_version_id TEXT NOT NULL,
  package_version_file_id TEXT NOT NULL,
  dist_id TEXT NOT NULL,
  directory TEXT NOT NULL,
  name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  mtime DATETIME NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS package_version_files_uk_package_version_file_id ON package_version_files (package_version_file_id);
CREATE UNIQUE INDEX IF NOT EXISTS package_version_files_ux_package_version_id_directory_name ON package_version_files (package_version_id, directory, name);


CREATE TABLE IF NOT EXISTS package_version_manifests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmt_create DATETIME NOT NULL,
  gmt_modified DATETIME NOT NULL,
  package_id TEXT NOT NULL,
  package_version_id TEXT NOT NULL,
  package_version_manifest_id TEXT NOT NULL,
  manifest TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS package_version_manifests_uk_package_version_manifest_id ON package_version_manifests (package_version_manifest_id);
CREATE UNIQUE INDEX IF NOT EXISTS package_version_manifests_uk_package_version_id ON package_version_manifests (package_version_id);
CREATE INDEX IF NOT EXISTS package_version_manifests_idx_package_id ON package_version_manifests (package_id);


CREATE TABLE IF NOT EXISTS package_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmt_create DATETIME NOT NULL,
  gmt_modified DATETIME NOT NULL,
  package_id TEXT NOT NULL,
  package_version_id TEXT NOT NULL,
  version TEXT NOT NULL,
  abbreviated_dist_id TEXT NOT NULL,
  manifest_dist_id TEXT NOT NULL,
  tar_dist_id TEXT NOT NULL,
  readme_dist_id TEXT NOT NULL,
  publish_time DATETIME NOT NULL,
  padding_version TEXT DEFAULT NULL,
  is_pre_release INTEGER DEFAULT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS package_versions_uk_package_version_id ON package_versions (package_version_id);
CREATE UNIQUE INDEX IF NOT EXISTS package_versions_uk_package_id_version ON package_versions (package_id, version);
CREATE INDEX IF NOT EXISTS package_versions_idx_pkg_id_is_pre_release_padding_version ON package_versions (package_id, padding_version, is_pre_release, version);


CREATE TABLE IF NOT EXISTS packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmt_create DATETIME NOT NULL,
  gmt_modified DATETIME NOT NULL,
  package_id TEXT NOT NULL,
  is_private INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  scope TEXT NOT NULL,
  description TEXT DEFAULT NULL,
  abbreviateds_dist_id TEXT DEFAULT NULL,
  manifests_dist_id TEXT DEFAULT NULL,
  registry_id TEXT DEFAULT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS packages_uk_package_id ON packages (package_id);
CREATE UNIQUE INDEX IF NOT EXISTS packages_uk_scope_name ON packages (scope, name);


CREATE TABLE IF NOT EXISTS proxy_caches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmt_create DATETIME NOT NULL,
  gmt_modified DATETIME NOT NULL,
  fullname TEXT NOT NULL DEFAULT '',
  version TEXT DEFAULT NULL,
  file_type TEXT NOT NULL DEFAULT '',
  file_path TEXT NOT NULL DEFAULT ''
);

CREATE UNIQUE INDEX IF NOT EXISTS proxy_caches_uk_package_version_path_name ON proxy_caches (file_path);
CREATE UNIQUE INDEX IF NOT EXISTS proxy_caches_ux_package_version_file_name ON proxy_caches (fullname, file_type, version);


CREATE TABLE IF NOT EXISTS registries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmt_create DATETIME NOT NULL,
  gmt_modified DATETIME NOT NULL,
  registry_id TEXT NOT NULL,
  name TEXT DEFAULT NULL,
  host TEXT DEFAULT NULL,
  change_stream TEXT DEFAULT NULL,
  type TEXT DEFAULT NULL,
  user_prefix TEXT DEFAULT NULL,
  auth_token TEXT DEFAULT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS registries_uk_name ON registries (name);


CREATE TABLE IF NOT EXISTS scopes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmt_create DATETIME NOT NULL,
  gmt_modified DATETIME NOT NULL,
  scope_id TEXT NOT NULL,
  name TEXT DEFAULT NULL,
  registry_id TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS scopes_uk_name ON scopes (name);


CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmt_create DATETIME NOT NULL,
  gmt_modified DATETIME NOT NULL,
  task_id TEXT NOT NULL,
  type TEXT NOT NULL,
  state TEXT NOT NULL,
  target_name TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_ip TEXT NOT NULL,
  data TEXT DEFAULT NULL,
  log_path TEXT NOT NULL,
  log_store_position TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  error TEXT,
  biz_id TEXT DEFAULT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS tasks_uk_task_id ON tasks (task_id);
CREATE UNIQUE INDEX IF NOT EXISTS tasks_uk_biz_id ON tasks (biz_id);
CREATE INDEX IF NOT EXISTS tasks_idx_type_state_target_name ON tasks (target_name, type, state);
CREATE INDEX IF NOT EXISTS tasks_idx_type_state_gmt_modified ON tasks (type, state, gmt_modified);
CREATE INDEX IF NOT EXISTS tasks_idx_gmt_modified ON tasks (gmt_modified);


CREATE TABLE IF NOT EXISTS token_packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmt_create DATETIME NOT NULL,
  gmt_modified DATETIME NOT NULL,
  token_id TEXT NOT NULL,
  package_id TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS token_packages_uk_token_id_package_id ON token_packages (token_id, package_id);
CREATE INDEX IF NOT EXISTS token_packages_idx_token_id ON token_packages (token_id);
CREATE INDEX IF NOT EXISTS token_packages_idx_package_id ON token_packages (package_id);


CREATE TABLE IF NOT EXISTS tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmt_create DATETIME NOT NULL,
  gmt_modified DATETIME NOT NULL,
  token_id TEXT NOT NULL,
  token_mark TEXT NOT NULL,
  token_key TEXT NOT NULL,
  is_readonly INTEGER NOT NULL DEFAULT 0,
  is_automation INTEGER NOT NULL DEFAULT 0,
  cidr_whitelist TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT DEFAULT NULL,
  type TEXT DEFAULT NULL,
  description TEXT DEFAULT NULL,
  allowed_scopes TEXT,
  expired_at DATETIME DEFAULT NULL,
  last_used_at DATETIME DEFAULT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS tokens_uk_token_id ON tokens (token_id);
CREATE UNIQUE INDEX IF NOT EXISTS tokens_uk_token_key ON tokens (token_key);
CREATE UNIQUE INDEX IF NOT EXISTS tokens_uk_user_id_name ON tokens (user_id, name);
CREATE INDEX IF NOT EXISTS tokens_idx_user_id ON tokens (user_id);


CREATE TABLE IF NOT EXISTS total (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  total_id TEXT NOT NULL,
  gmt_create DATETIME NOT NULL,
  gmt_modified DATETIME NOT NULL,
  package_count INTEGER NOT NULL DEFAULT 0,
  package_file_size INTEGER NOT NULL DEFAULT 0,
  package_version_count INTEGER NOT NULL DEFAULT 0,
  package_version_delete_count INTEGER NOT NULL DEFAULT 0,
  private_package_count INTEGER NOT NULL DEFAULT 0,
  private_package_file_size INTEGER NOT NULL DEFAULT 0,
  private_package_version_count INTEGER NOT NULL DEFAULT 0,
  private_package_version_delete_count INTEGER NOT NULL DEFAULT 0,
  change_stream_seq TEXT DEFAULT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS total_uk_total_id ON total (total_id);


CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmt_create DATETIME NOT NULL,
  gmt_modified DATETIME NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_integrity TEXT NOT NULL,
  ip TEXT NOT NULL,
  is_private INTEGER NOT NULL DEFAULT 1,
  scopes TEXT DEFAULT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS users_uk_user_id ON users (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS users_uk_name ON users (name);


CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmt_create DATETIME NOT NULL,
  gmt_modified DATETIME NOT NULL,
  wanc_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  credential_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  browser_type TEXT DEFAULT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS webauthn_credentials_uk_wanc_id ON webauthn_credentials (wanc_id);
CREATE INDEX IF NOT EXISTS webauthn_credentials_idx_user_id ON webauthn_credentials (user_id);


CREATE TABLE IF NOT EXISTS totals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gmt_create DATETIME NOT NULL,
  gmt_modified DATETIME NOT NULL,
  type TEXT NOT NULL,
  count INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS totals_uk_type ON totals (type);
