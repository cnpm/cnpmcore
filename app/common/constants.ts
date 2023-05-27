export const BUG_VERSIONS = 'bug-versions';
export const LATEST_TAG = 'latest';
export const GLOBAL_WORKER = 'GLOBAL_WORKER';
export enum SyncMode {
  none = 'none',
  admin = 'admin',
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
