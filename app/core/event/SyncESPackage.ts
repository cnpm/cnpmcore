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
  PACKAGE_META_CHANGED, PackageMetaChange,
} from './index';

import { PackageSearchService } from '../service/PackageSearchService';
import { User } from '../entity/User';

class SyncESPackage {
  @Inject()
  protected readonly packageSearchService: PackageSearchService;

  @Inject()
  protected readonly config: EggAppConfig;

  protected async doSomething(): Promise<unknown> {
    throw Error('Not Implemented');
  }
}

@Event(PACKAGE_UNPUBLISHED)
export class PackageUnpublished extends SyncESPackage {
  async handle() {
    throw Error('Not Implemented');
  }
}

@Event(PACKAGE_VERSION_ADDED)
export class PackageVersionAdded extends SyncESPackage {
  async handle(_fullname: string, _version: string, _tag?: string) {
    throw Error('Not Implemented');
  }
}

@Event(PACKAGE_VERSION_REMOVED)
export class PackageVersionRemoved extends SyncESPackage {
  async handle(_fullname: string, _version: string, _tag?: string) {
    throw Error('Not Implemented');
  }
}

@Event(PACKAGE_TAG_ADDED)
export class PackageTagAdded extends SyncESPackage {
  async handle(_fullname: string, _tag: string) {
    throw Error('Not Implemented');
  }
}

@Event(PACKAGE_TAG_CHANGED)
export class PackageTagChanged extends SyncESPackage {
  async handle(_fullname: string, _tag: string) {
    throw Error('Not Implemented');
  }
}

@Event(PACKAGE_TAG_REMOVED)
export class PackageTagRemoved extends SyncESPackage {
  async handle(_fullname: string, _tag: string) {
    throw Error('Not Implemented');
  }
}

@Event(PACKAGE_MAINTAINER_CHANGED)
export class PackageMaintainerChanged extends SyncESPackage {
  async handle(_fullname: string, _maintainers: User[]) {
    throw Error('Not Implemented');
  }
}

@Event(PACKAGE_MAINTAINER_REMOVED)
export class PackageMaintainerRemoved extends SyncESPackage {
  async handle(_fullname: string, _maintainer: string) {
    throw Error('Not Implemented');
  }
}

@Event(PACKAGE_META_CHANGED)
export class PackageMetaChanged extends SyncESPackage {
  async handle(_fullname: string, _meta: PackageMetaChange) {
    throw Error('Not Implemented');
  }
}
