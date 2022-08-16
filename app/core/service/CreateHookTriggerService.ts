import { AccessLevel, ContextProto, Inject } from '@eggjs/tegg';
import { AbstractService } from '../../common/AbstractService';
import { HookType } from '../../common/enum/Hook';
import { TaskState } from '../../common/enum/Task';
import { HookEvent } from '../entity/HookEvent';
import { CreateHookTask, Task } from '../entity/Task';
import { HookRepository } from '../../repository/HookRepository';
import { PackageRepository } from '../../repository/PackageRepository';
import pMap from 'p-map';
import { Hook } from '../entity/Hook';
import { TaskService } from './TaskService';
import { isoNow } from '../../common/LogUtil';
import { getScopeAndName } from '../../common/PackageUtil';

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class CreateHookTriggerService extends AbstractService {
  @Inject()
  private readonly hookRepository: HookRepository;

  @Inject()
  private readonly packageRepository: PackageRepository;

  @Inject()
  private readonly taskService: TaskService;

  async executeTask(task: CreateHookTask): Promise<void> {
    const { hookEvent } = task.data;
    const [ scope, name ] = getScopeAndName(hookEvent.fullname);
    const pkg = await this.packageRepository.findPackage(scope, name);
    if (!pkg) {
      await this.taskService.finishTask(task, TaskState.Success, `[${isoNow()}][Hooks] package ${hookEvent.fullname} not exits`);
      return;
    }

    const startLog = [
      `[${isoNow()}][Hooks] Start Create Trigger for ${pkg.fullname} ${task.data.hookEvent.changeId}`,
      `[${isoNow()}][Hooks] change content ${JSON.stringify(task.data.hookEvent.change)}`,
    ];
    await this.taskService.finishTask(task, TaskState.Processing, startLog.join('\n'));

    try {
      await this.taskService.appendTaskLog(task, `[${isoNow()}][Hooks] PushHooks to ${HookType.Package} ${pkg.fullname}\n`);
      await this.createTriggerByMethod(task, HookType.Package, pkg.fullname, hookEvent);
      await this.taskService.appendTaskLog(task, `[${isoNow()}][Hooks] PushHooks to ${HookType.Scope} ${pkg.scope}\n`);
      await this.createTriggerByMethod(task, HookType.Scope, pkg.scope, hookEvent);

      const maintainers = await this.packageRepository.listPackageMaintainers(pkg.packageId);
      for (const maintainer of maintainers) {
        await this.taskService.appendTaskLog(task, `[${isoNow()}][Hooks] PushHooks to ${HookType.Owner} ${maintainer.name}\n`);
        await this.createTriggerByMethod(task, HookType.Owner, maintainer.name, hookEvent);
      }
      await this.taskService.finishTask(task, TaskState.Success, `[${isoNow()}][Hooks] create trigger succeed \n`);
    } catch (e) {
      e.message = 'create trigger failed: ' + e.message;
      await this.taskService.finishTask(task, TaskState.Fail, `[${isoNow()}][Hooks] ${e.stack} \n`);
      return;
    }
  }

  private async createTriggerByMethod(task: Task, type: HookType, name: string, hookEvent: HookEvent) {
    let hooks = await this.hookRepository.listHooksByTypeAndName(type, name);
    while (hooks.length) {
      await this.createTriggerTasks(hooks, hookEvent);
      hooks = await this.hookRepository.listHooksByTypeAndName(type, name, hooks[hooks.length - 1].id);
      await this.taskService.appendTaskLog(task,
        `[${isoNow()}][Hooks] PushHooks to ${type} ${name} ${hooks.length} \n`);
    }
  }

  private async createTriggerTasks(hooks: Array<Hook>, hookEvent: HookEvent) {
    await pMap(hooks, async hook => {
      const triggerHookTask = Task.createTriggerHookTask(hookEvent, hook.hookId);
      await this.taskService.createTask(triggerHookTask, true);
    }, { concurrency: 5 });
  }
}
