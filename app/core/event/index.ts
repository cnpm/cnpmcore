import '@eggjs/tegg';

export const PACKAGE_PUBLISHED = 'PACKAGE_PUBLISHED';
export const PACKAGE_MAINTAINER_CHANGED = 'PACKAGE_MAINTAINER_CHANGED';
export const PACKAGE_TAG_ADDED = 'PACKAGE_TAG_ADDED';
export const PACKAGE_TAG_CHANGED = 'PACKAGE_TAG_CHANGED';

declare module '@eggjs/tegg' {
  interface Events {
    [PACKAGE_PUBLISHED]: (packageVersionId: string) => Promise<void>;
    [PACKAGE_MAINTAINER_CHANGED]: (packageId: string) => Promise<void>;
    [PACKAGE_TAG_ADDED]: (packageTagId: string) => Promise<void>;
    [PACKAGE_TAG_CHANGED]: (packageTagId: string) => Promise<void>;
  }
}
