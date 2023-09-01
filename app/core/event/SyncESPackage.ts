// TODO sync event
/* eslint-disable @typescript-eslint/no-unused-vars */
import { EggAppConfig } from 'egg';
import { Event, Inject } from '@eggjs/tegg';
import {
  PACKAGE_UNPUBLISHED,
  PACKAGE_VERSION_ADDED,
  PACKAGE_VERSION_REMOVED,
  PACKAGE_TAG_ADDED,
  PACKAGE_TAG_CHANGED,
  PACKAGE_TAG_REMOVED,
  PACKAGE_MAINTAINER_CHANGED,
  PACKAGE_MAINTAINER_REMOVED,
  PACKAGE_META_CHANGED,
} from './index';

import { PackageSearchService } from '../service/PackageSearchService';

class SyncESPackage {
  @Inject()
  protected readonly packageSearchService: PackageSearchService;

  @Inject()
  protected readonly config: EggAppConfig;

  protected async syncPackage(fullname: string) {
    if (!this.config.cnpmcore.enableElasticsearch) return;
    await this.packageSearchService.syncPackage(fullname, true);
  }
}

@Event(PACKAGE_UNPUBLISHED)
export class PackageUnpublished extends SyncESPackage {
  async handle(fullname: string) {
    if (!this.config.cnpmcore.enableElasticsearch) return;
    await this.packageSearchService.removePackage(fullname);
  }
}

@Event(PACKAGE_VERSION_ADDED)
export class PackageVersionAdded extends SyncESPackage {
  async handle(fullname: string) {
    await this.syncPackage(fullname);
  }
}

@Event(PACKAGE_VERSION_REMOVED)
export class PackageVersionRemoved extends SyncESPackage {
  async handle(fullname: string) {
    await this.syncPackage(fullname);
  }
}

@Event(PACKAGE_TAG_ADDED)
export class PackageTagAdded extends SyncESPackage {
  async handle(fullname: string) {
    await this.syncPackage(fullname);
  }
}

@Event(PACKAGE_TAG_CHANGED)
export class PackageTagChanged extends SyncESPackage {
  async handle(fullname: string) {
    await this.syncPackage(fullname);
  }
}

@Event(PACKAGE_TAG_REMOVED)
export class PackageTagRemoved extends SyncESPackage {
  async handle(fullname: string) {
    await this.syncPackage(fullname);
  }
}

@Event(PACKAGE_MAINTAINER_CHANGED)
export class PackageMaintainerChanged extends SyncESPackage {
  async handle(fullname: string) {
    await this.syncPackage(fullname);
  }
}

@Event(PACKAGE_MAINTAINER_REMOVED)
export class PackageMaintainerRemoved extends SyncESPackage {
  async handle(fullname: string) {
    await this.syncPackage(fullname);
  }
}

@Event(PACKAGE_META_CHANGED)
export class PackageMetaChanged extends SyncESPackage {
  async handle(fullname: string) {
    await this.syncPackage(fullname);
  }
}
