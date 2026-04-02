CREATE TABLE orgs (
  id BIGSERIAL PRIMARY KEY,
  gmt_create timestamp(3) NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  org_id varchar(24) NOT NULL,
  name varchar(214) NOT NULL,
  description varchar(10240) DEFAULT NULL
);

CREATE UNIQUE INDEX orgs_uk_org_id ON orgs (org_id);
CREATE UNIQUE INDEX orgs_uk_name ON orgs (name);

CREATE TABLE org_members (
  id BIGSERIAL PRIMARY KEY,
  gmt_create timestamp(3) NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  org_member_id varchar(24) NOT NULL,
  org_id varchar(24) NOT NULL,
  user_id varchar(24) NOT NULL,
  role varchar(20) NOT NULL DEFAULT 'member'
);

CREATE UNIQUE INDEX org_members_uk_org_member_id ON org_members (org_member_id);
CREATE UNIQUE INDEX org_members_uk_org_id_user_id ON org_members (org_id, user_id);
CREATE INDEX org_members_idx_user_id ON org_members (user_id);

CREATE TABLE teams (
  id BIGSERIAL PRIMARY KEY,
  gmt_create timestamp(3) NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  team_id varchar(24) NOT NULL,
  org_id varchar(24) NOT NULL,
  name varchar(214) NOT NULL,
  description varchar(10240) DEFAULT NULL
);

CREATE UNIQUE INDEX teams_uk_team_id ON teams (team_id);
CREATE UNIQUE INDEX teams_uk_org_id_name ON teams (org_id, name);
CREATE INDEX teams_idx_org_id ON teams (org_id);

CREATE TABLE team_members (
  id BIGSERIAL PRIMARY KEY,
  gmt_create timestamp(3) NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  team_member_id varchar(24) NOT NULL,
  team_id varchar(24) NOT NULL,
  user_id varchar(24) NOT NULL,
  role varchar(20) NOT NULL DEFAULT 'member'
);

CREATE UNIQUE INDEX team_members_uk_team_member_id ON team_members (team_member_id);
CREATE UNIQUE INDEX team_members_uk_team_id_user_id ON team_members (team_id, user_id);
CREATE INDEX team_members_idx_user_id ON team_members (user_id);

CREATE TABLE team_packages (
  id BIGSERIAL PRIMARY KEY,
  gmt_create timestamp(3) NOT NULL,
  gmt_modified timestamp(3) NOT NULL,
  team_package_id varchar(24) NOT NULL,
  team_id varchar(24) NOT NULL,
  package_id varchar(24) NOT NULL
);

CREATE UNIQUE INDEX team_packages_uk_team_package_id ON team_packages (team_package_id);
CREATE UNIQUE INDEX team_packages_uk_team_id_package_id ON team_packages (team_id, package_id);
CREATE INDEX team_packages_idx_package_id ON team_packages (package_id);
