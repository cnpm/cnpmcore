import { Event, Inject } from '@eggjs/tegg';
import {
  PACKAGE_UNPUBLISHED,
  PACKAGE_BLOCKED,
  PACKAGE_UNBLOCKED,
  PACKAGE_VERSION_ADDED,
  PACKAGE_VERSION_REMOVED,
  PACKAGE_TAG_ADDED,
  PACKAGE_TAG_CHANGED,
  PACKAGE_TAG_REMOVED,
  PACKAGE_MAINTAINER_CHANGED,
  PACKAGE_MAINTAINER_REMOVED,
  PACKAGE_META_CHANGED,
} from './index';
import { CacheService } from '../../core/service/CacheService';

class CacheCleanerEvent {
  @Inject()
  private readonly cacheService: CacheService;

  protected async removeCache(fullname: string) {
    await this.cacheService.removeCache(fullname);
  }
}

@Event(PACKAGE_UNPUBLISHED)
export class PackageUnpublished extends CacheCleanerEvent {
  async handle(fullname: string) {
    await this.removeCache(fullname);
  }
}

@Event(PACKAGE_BLOCKED)
export class PackageBlocked extends CacheCleanerEvent {
  async handle(fullname: string) {
    await this.removeCache(fullname);
  }
}

@Event(PACKAGE_UNBLOCKED)
export class PackageUnblocked extends CacheCleanerEvent {
  async handle(fullname: string) {
    await this.removeCache(fullname);
  }
}

@Event(PACKAGE_VERSION_ADDED)
export class PackageVersionAdded extends CacheCleanerEvent {
  async handle(fullname: string) {
    await this.removeCache(fullname);
  }
}

@Event(PACKAGE_VERSION_REMOVED)
export class PackageVersionRemoved extends CacheCleanerEvent {
  async handle(fullname: string) {
    await this.removeCache(fullname);
  }
}

@Event(PACKAGE_TAG_ADDED)
export class PackageTagAdded extends CacheCleanerEvent {
  async handle(fullname: string) {
    await this.removeCache(fullname);
  }
}

@Event(PACKAGE_TAG_CHANGED)
export class PackageTagChanged extends CacheCleanerEvent {
  async handle(fullname: string) {
    await this.removeCache(fullname);
  }
}

@Event(PACKAGE_TAG_REMOVED)
export class PackageTagRemoved extends CacheCleanerEvent {
  async handle(fullname: string) {
    await this.removeCache(fullname);
  }
}

@Event(PACKAGE_MAINTAINER_CHANGED)
export class PackageMaintainerChanged extends CacheCleanerEvent {
  async handle(fullname: string) {
    await this.removeCache(fullname);
  }
}

@Event(PACKAGE_MAINTAINER_REMOVED)
export class PackageMaintainerRemoved extends CacheCleanerEvent {
  async handle(fullname: string) {
    await this.removeCache(fullname);
  }
}

@Event(PACKAGE_META_CHANGED)
export class PackageMetaChanged extends CacheCleanerEvent {
  async handle(fullname: string) {
    await this.removeCache(fullname);
  }
}
