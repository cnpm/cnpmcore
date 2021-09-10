import '@eggjs/tegg';

export const PACKAGE_PUBLISHED = 'PACKAGE_PUBLISHED';

declare module '@eggjs/tegg' {
  interface Events {
    [PACKAGE_PUBLISHED]: (packageVersionId: string) => Promise<void>;
  }
}
