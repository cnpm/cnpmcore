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
import { ChangeRepository } from '../../repository/ChangeRepository';
import { Change } from '../entity/Change';

class ChangesStreamEvent {
  @Inject()
  private readonly changeRepository: ChangeRepository;

  protected async addChange(type: string, fullname: string, data: object) {
    await this.changeRepository.addChange(Change.create({
      type,
      targetName: fullname,
      data,
    }));
  }
}

@Event(PACKAGE_UNPUBLISHED)
export class PackageUnpublished extends ChangesStreamEvent {
  async handle(fullname: string) {
    await this.addChange(PACKAGE_UNPUBLISHED, fullname, {});
  }
}

@Event(PACKAGE_VERSION_ADDED)
export class PackageVersionAdded extends ChangesStreamEvent {
  async handle(fullname: string, version: string) {
    await this.addChange(PACKAGE_VERSION_ADDED, fullname, { version });
  }
}

@Event(PACKAGE_VERSION_REMOVED)
export class PackageVersionRemoved extends ChangesStreamEvent {
  async handle(fullname: string, version: string) {
    await this.addChange(PACKAGE_VERSION_REMOVED, fullname, { version });
  }
}

@Event(PACKAGE_TAG_ADDED)
export class PackageTagAdded extends ChangesStreamEvent {
  async handle(fullname: string, tag: string) {
    await this.addChange(PACKAGE_TAG_ADDED, fullname, { tag });
  }
}

@Event(PACKAGE_TAG_CHANGED)
export class PackageTagChanged extends ChangesStreamEvent {
  async handle(fullname: string, tag: string) {
    await this.addChange(PACKAGE_TAG_CHANGED, fullname, { tag });
  }
}

@Event(PACKAGE_TAG_REMOVED)
export class PackageTagRemoved extends ChangesStreamEvent {
  async handle(fullname: string, tag: string) {
    await this.addChange(PACKAGE_TAG_REMOVED, fullname, { tag });
  }
}

@Event(PACKAGE_MAINTAINER_CHANGED)
export class PackageMaintainerChanged extends ChangesStreamEvent {
  async handle(fullname: string) {
    await this.addChange(PACKAGE_MAINTAINER_CHANGED, fullname, {});
  }
}

@Event(PACKAGE_MAINTAINER_REMOVED)
export class PackageMaintainerRemoved extends ChangesStreamEvent {
  async handle(fullname: string, maintainer: string) {
    await this.addChange(PACKAGE_MAINTAINER_REMOVED, fullname, { maintainer });
  }
}

@Event(PACKAGE_META_CHANGED)
export class PackageMetaChanged extends ChangesStreamEvent {
  async handle(fullname: string, meta: object) {
    await this.addChange(PACKAGE_META_CHANGED, fullname, { ...meta });
  }
}
