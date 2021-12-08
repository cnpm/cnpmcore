import '@eggjs/tegg';

export const PACKAGE_MAINTAINER_CHANGED = 'PACKAGE_MAINTAINER_CHANGED';
export const PACKAGE_VERSION_ADDED = 'PACKAGE_VERSION_ADDED';
export const PACKAGE_VERSION_REMOVED = 'PACKAGE_VERSION_REMOVED';
export const PACKAGE_TAG_ADDED = 'PACKAGE_TAG_ADDED';
export const PACKAGE_TAG_CHANGED = 'PACKAGE_TAG_CHANGED';
export const PACKAGE_TAG_REMOVED = 'PACKAGE_TAG_REMOVED';

declare module '@eggjs/tegg' {
  interface Events {
    [PACKAGE_MAINTAINER_CHANGED]: (packageId: string) => Promise<void>;
    [PACKAGE_VERSION_ADDED]: (packageId: string, packageVersionId: string, version: string) => Promise<void>;
    [PACKAGE_VERSION_REMOVED]: (packageId: string, packageVersionId: string, version: string) => Promise<void>;
    [PACKAGE_TAG_ADDED]: (packageId: string, packageTagId: string, tag: string) => Promise<void>;
    [PACKAGE_TAG_CHANGED]: (packageId: string, packageTagId: string, tag: string) => Promise<void>;
    [PACKAGE_TAG_REMOVED]: (packageId: string, packageTagId: string, tag: string) => Promise<void>;
  }
}
