import '@eggjs/tegg';

export const PACKAGE_PUBLISHED = 'PACKAGE_PUBLISHED';
export const PACKAGE_UPSTREAM_CHANGED = 'PACKAGE_UPSTREAM_CHANGED';

declare module '@eggjs/tegg' {
  interface Events {
    [PACKAGE_PUBLISHED]: (packageVersionId: string) => Promise<void>;
  }
}
