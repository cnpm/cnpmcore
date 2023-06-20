export const BUG_VERSIONS = 'bug-versions';
export const LATEST_TAG = 'latest';
export const GLOBAL_WORKER = 'GLOBAL_WORKER';
export const NOT_IMPLEMENTED_PATH = [ '/-/npm/v1/security/audits/quick', '/-/npm/v1/security/advisories/bulk' ];
export const PROXY_MODE_CACHED_PACKAGE_DIR_NAME = 'proxy-mode-cached-packages';
export enum SyncMode {
  none = 'none',
  admin = 'admin',
  proxy = 'proxy',
  exist = 'exist',
  all = 'all',
}
export enum ChangesStreamMode {
  json = 'json',
  streaming = 'streaming',
}
export enum SyncDeleteMode {
  ignore = 'ignore',
  block = 'block',
  delete = 'delete',
}

export enum PresetRegistryName {
  default = 'default',
  self = 'self',
}

export enum PackageAccessLevel {
  write = 'write',
  read = 'read',
}
