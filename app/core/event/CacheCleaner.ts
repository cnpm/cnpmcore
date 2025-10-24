import { Event, Inject } from 'egg';

import {
  PACKAGE_BLOCKED,
  PACKAGE_MAINTAINER_CHANGED,
  PACKAGE_MAINTAINER_REMOVED,
  PACKAGE_META_CHANGED,
  PACKAGE_TAG_ADDED,
  PACKAGE_TAG_CHANGED,
  PACKAGE_TAG_REMOVED,
  PACKAGE_UNBLOCKED,
  PACKAGE_UNPUBLISHED,
  PACKAGE_VERSION_ADDED,
  PACKAGE_VERSION_REMOVED,
} from './index.ts';
import type { CacheService } from '../../core/service/CacheService.ts';

class CacheCleanerEvent {
  @Inject()
  private readonly cacheService: CacheService;

  protected async removeCache(fullname: string) {
    await this.cacheService.removeCache(fullname);
  }
}

@Event(PACKAGE_UNPUBLISHED)
export class PackageUnpublishedCacheCleanEvent extends CacheCleanerEvent {
  async handle(fullname: string) {
    await this.removeCache(fullname);
  }
}

@Event(PACKAGE_BLOCKED)
export class PackageBlockedCacheCleanEvent extends CacheCleanerEvent {
  async handle(fullname: string) {
    await this.removeCache(fullname);
  }
}

@Event(PACKAGE_UNBLOCKED)
export class PackageUnblockedCacheCleanEvent extends CacheCleanerEvent {
  async handle(fullname: string) {
    await this.removeCache(fullname);
  }
}

@Event(PACKAGE_VERSION_ADDED)
export class PackageVersionAddedCacheCleanEvent extends CacheCleanerEvent {
  async handle(fullname: string) {
    await this.removeCache(fullname);
  }
}

@Event(PACKAGE_VERSION_REMOVED)
export class PackageVersionRemovedCacheCleanEvent extends CacheCleanerEvent {
  async handle(fullname: string) {
    await this.removeCache(fullname);
  }
}

@Event(PACKAGE_TAG_ADDED)
export class PackageTagAddedCacheCleanEvent extends CacheCleanerEvent {
  async handle(fullname: string) {
    await this.removeCache(fullname);
  }
}

@Event(PACKAGE_TAG_CHANGED)
export class PackageTagChangedCacheCleanEvent extends CacheCleanerEvent {
  async handle(fullname: string) {
    await this.removeCache(fullname);
  }
}

@Event(PACKAGE_TAG_REMOVED)
export class PackageTagRemovedCacheCleanEvent extends CacheCleanerEvent {
  async handle(fullname: string) {
    await this.removeCache(fullname);
  }
}

@Event(PACKAGE_MAINTAINER_CHANGED)
export class PackageMaintainerChangedCacheCleanEvent extends CacheCleanerEvent {
  async handle(fullname: string) {
    await this.removeCache(fullname);
  }
}

@Event(PACKAGE_MAINTAINER_REMOVED)
export class PackageMaintainerRemovedCacheCleanEvent extends CacheCleanerEvent {
  async handle(fullname: string) {
    await this.removeCache(fullname);
  }
}

@Event(PACKAGE_META_CHANGED)
export class PackageMetaChangedCacheCleanEvent extends CacheCleanerEvent {
  async handle(fullname: string) {
    await this.removeCache(fullname);
  }
}
