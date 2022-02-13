import '@eggjs/tegg';

export const PACKAGE_UNPUBLISHED = 'PACKAGE_UNPUBLISHED';
export const PACKAGE_BLOCKED = 'PACKAGE_BLOCKED';
export const PACKAGE_UNBLOCKED = 'PACKAGE_UNBLOCKED';
export const PACKAGE_VERSION_ADDED = 'PACKAGE_VERSION_ADDED';
export const PACKAGE_VERSION_REMOVED = 'PACKAGE_VERSION_REMOVED';
export const PACKAGE_TAG_ADDED = 'PACKAGE_TAG_ADDED';
export const PACKAGE_TAG_CHANGED = 'PACKAGE_TAG_CHANGED';
export const PACKAGE_TAG_REMOVED = 'PACKAGE_TAG_REMOVED';
export const PACKAGE_MAINTAINER_CHANGED = 'PACKAGE_MAINTAINER_CHANGED';
export const PACKAGE_MAINTAINER_REMOVED = 'PACKAGE_MAINTAINER_REMOVED';
export const PACKAGE_META_CHANGED = 'PACKAGE_META_CHANGED';

declare module '@eggjs/tegg' {
  interface Events {
    [PACKAGE_UNPUBLISHED]: (fullname: string) => Promise<void>;
    [PACKAGE_BLOCKED]: (fullname: string) => Promise<void>;
    [PACKAGE_UNBLOCKED]: (fullname: string) => Promise<void>;
    [PACKAGE_VERSION_ADDED]: (fullname: string, version: string) => Promise<void>;
    [PACKAGE_VERSION_REMOVED]: (fullname: string, version: string) => Promise<void>;
    [PACKAGE_TAG_ADDED]: (fullname: string, tag: string) => Promise<void>;
    [PACKAGE_TAG_CHANGED]: (fullname: string, tag: string) => Promise<void>;
    [PACKAGE_TAG_REMOVED]: (fullname: string, tag: string) => Promise<void>;
    [PACKAGE_MAINTAINER_CHANGED]: (fullname: string) => Promise<void>;
    [PACKAGE_MAINTAINER_REMOVED]: (fullname: string, maintainer: string) => Promise<void>;
    [PACKAGE_META_CHANGED]: (fullname: string, meta: object) => Promise<void>;
  }
}
