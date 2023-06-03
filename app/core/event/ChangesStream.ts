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
import { ChangeRepository } from '../../repository/ChangeRepository';
import { Change } from '../entity/Change';
import { HookEvent } from '../entity/HookEvent';
import { Task } from '../entity/Task';
import { User } from '../entity/User';
import { TaskService } from '../service/TaskService';

class ChangesStreamEvent {
  @Inject()
  private readonly changeRepository: ChangeRepository;

  @Inject()
  protected readonly taskService: TaskService;

  @Inject()
  protected readonly config: EggAppConfig;

  protected get hookEnable() {
    return this.config.cnpmcore.hookEnable;
  }

  protected async addChange(type: string, fullname: string, data: object): Promise<Change> {
    const change = Change.create({
      type,
      targetName: fullname,
      data,
    });
    await this.changeRepository.addChange(change);
    return change;
  }
}

@Event(PACKAGE_UNPUBLISHED)
export class PackageUnpublished extends ChangesStreamEvent {
  async handle(fullname: string) {
    const change = await this.addChange(PACKAGE_UNPUBLISHED, fullname, {});
    if (this.hookEnable) {
      const task = Task.createCreateHookTask(HookEvent.createUnpublishEvent(fullname, change.changeId));
      await this.taskService.createTask(task, true);
    }
  }
}

@Event(PACKAGE_VERSION_ADDED)
export class PackageVersionAdded extends ChangesStreamEvent {
  async handle(fullname: string, version: string, tag?: string) {
    const change = await this.addChange(PACKAGE_VERSION_ADDED, fullname, { version });
    if (this.hookEnable) {
      const task = Task.createCreateHookTask(HookEvent.createPublishEvent(fullname, change.changeId, version, tag));
      await this.taskService.createTask(task, true);
    }
  }
}

@Event(PACKAGE_VERSION_REMOVED)
export class PackageVersionRemoved extends ChangesStreamEvent {
  async handle(fullname: string, version: string, tag?: string) {
    const change = await this.addChange(PACKAGE_VERSION_REMOVED, fullname, { version });
    if (this.hookEnable) {
      const task = Task.createCreateHookTask(HookEvent.createUnpublishEvent(fullname, change.changeId, version, tag));
      await this.taskService.createTask(task, true);
    }
  }
}

@Event(PACKAGE_TAG_ADDED)
export class PackageTagAdded extends ChangesStreamEvent {
  async handle(fullname: string, tag: string) {
    const change = await this.addChange(PACKAGE_TAG_ADDED, fullname, { tag });
    if (this.hookEnable) {
      const task = Task.createCreateHookTask(HookEvent.createDistTagEvent(fullname, change.changeId, tag));
      await this.taskService.createTask(task, true);
    }
  }
}

@Event(PACKAGE_TAG_CHANGED)
export class PackageTagChanged extends ChangesStreamEvent {
  async handle(fullname: string, tag: string) {
    const change = await this.addChange(PACKAGE_TAG_CHANGED, fullname, { tag });
    if (this.hookEnable) {
      const task = Task.createCreateHookTask(HookEvent.createDistTagEvent(fullname, change.changeId, tag));
      await this.taskService.createTask(task, true);
    }
  }
}

@Event(PACKAGE_TAG_REMOVED)
export class PackageTagRemoved extends ChangesStreamEvent {
  async handle(fullname: string, tag: string) {
    const change = await this.addChange(PACKAGE_TAG_REMOVED, fullname, { tag });
    if (this.hookEnable) {
      const task = Task.createCreateHookTask(HookEvent.createDistTagRmEvent(fullname, change.changeId, tag));
      await this.taskService.createTask(task, true);
    }
  }
}

@Event(PACKAGE_MAINTAINER_CHANGED)
export class PackageMaintainerChanged extends ChangesStreamEvent {
  async handle(fullname: string, maintainers: User[]) {
    const change = await this.addChange(PACKAGE_MAINTAINER_CHANGED, fullname, {});
    // TODO 应该比较差值，而不是全量推送
    if (this.hookEnable) {
      for (const maintainer of maintainers) {
        const task = Task.createCreateHookTask(HookEvent.createOwnerEvent(fullname, change.changeId, maintainer.name));
        await this.taskService.createTask(task, true);
      }
    }
  }
}

@Event(PACKAGE_MAINTAINER_REMOVED)
export class PackageMaintainerRemoved extends ChangesStreamEvent {
  async handle(fullname: string, maintainer: string) {
    const change = await this.addChange(PACKAGE_MAINTAINER_REMOVED, fullname, { maintainer });
    if (this.hookEnable) {
      const task = Task.createCreateHookTask(HookEvent.createOwnerRmEvent(fullname, change.changeId, maintainer));
      await this.taskService.createTask(task, true);
    }
  }
}

@Event(PACKAGE_META_CHANGED)
export class PackageMetaChanged extends ChangesStreamEvent {
  async handle(fullname: string, meta: PackageMetaChange) {
    const change = await this.addChange(PACKAGE_META_CHANGED, fullname, { ...meta });
    const { deprecateds } = meta;
    if (this.hookEnable) {
      for (const deprecated of deprecateds || []) {
        const task = Task.createCreateHookTask(HookEvent.createDeprecatedEvent(fullname, change.changeId, deprecated.version));
        await this.taskService.createTask(task, true);
      }
    }
  }
}
