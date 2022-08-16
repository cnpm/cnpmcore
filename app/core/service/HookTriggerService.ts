import { AccessLevel, ContextProto, Inject } from '@eggjs/tegg';
import { TriggerHookTask } from '../entity/Task';
import { HookEvent } from '../entity/HookEvent';
import { HookRepository } from '../../repository/HookRepository';
import { PackageRepository } from '../../repository/PackageRepository';
import { DistRepository } from '../../repository/DistRepository';
import { UserRepository } from '../../repository/UserRepository';
import { Hook } from '../entity/Hook';
import { EggContextHttpClient } from 'egg';
import { isoNow } from '../../common/LogUtil';
import { TaskState } from '../../common/enum/Task';
import { TaskService } from './TaskService';
import { getScopeAndName } from '../../common/PackageUtil';

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class HookTriggerService {
  @Inject()
  private readonly hookRepository: HookRepository;

  @Inject()
  private readonly packageRepository: PackageRepository;

  @Inject()
  private readonly distRepository: DistRepository;

  @Inject()
  private readonly userRepository: UserRepository;

  @Inject()
  private readonly httpclient: EggContextHttpClient;

  @Inject()
  private readonly taskService: TaskService;

  async executeTask(task: TriggerHookTask) {
    const { hookId, hookEvent } = task.data;
    const hook = await this.hookRepository.findHookById(hookId);
    if (!hook) {
      await this.taskService.finishTask(task, TaskState.Success, `[${isoNow()}][TriggerHooks] hook ${hookId} not exits`);
      return;
    }
    try {
      const payload = await this.createTriggerPayload(task, hookEvent, hook);
      if (!payload) {
        await this.taskService.finishTask(task, TaskState.Success, `[${isoNow()}][TriggerHooks] generate payload failed \n`);
        return;
      }
      const status = await this.doExecuteTrigger(hook, payload);
      hook.latestTaskId = task.taskId;
      task.data.responseStatus = status;
      await this.hookRepository.saveHook(hook);
      await this.taskService.finishTask(task, TaskState.Success, `[${isoNow()}][TriggerHooks] trigger hook succeed ${status} \n`);
    } catch (e) {
      e.message = 'trigger hook failed: ' + e.message;
      task.error = e.message;
      await this.taskService.finishTask(task, TaskState.Fail, `[${isoNow()}][TriggerHooks] ${e.stack} \n`);
      return;
    }
  }

  async doExecuteTrigger(hook: Hook, payload: object): Promise<number> {
    const { digest, payloadStr } = hook.signPayload(payload);
    const url = new URL(hook.endpoint);
    const res = await this.httpclient.request(hook.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-npm-signature': `sha256=${digest}`,
        host: url.host,
      },
      // webhook 场景下，由于 endpoint 都不同
      // 因此几乎不存在连接复用的情况，因此这里不使用 keepAlive
      agent: false,
      httpsAgent: false,
      data: payloadStr,
    } as any);
    if (res.status >= 200 && res.status < 300) {
      return res.status;
    }
    throw new Error(`hook response with ${res.status}`);
  }

  async createTriggerPayload(task: TriggerHookTask, hookEvent: HookEvent, hook: Hook): Promise<object | undefined> {
    const [ scope, name ] = getScopeAndName(hookEvent.fullname);
    const pkg = await this.packageRepository.findPackage(scope, name);
    if (!pkg) {
      await this.taskService.finishTask(task, TaskState.Success, `[${isoNow()}][TriggerHooks] can not found pkg for ${hookEvent.fullname} \n`);
      return;
    }
    const user = await this.userRepository.findUserByUserId(hook.ownerId);
    if (!user) {
      await this.taskService.finishTask(task, TaskState.Success, `[${isoNow()}][TriggerHooks] can not found user for ${hook.ownerId} \n`);
      return;
    }
    const manifest = await this.distRepository.readDistBytesToJSON(pkg!.manifestsDist!);
    return {
      event: hookEvent.event,
      name: pkg.fullname,
      type: 'package',
      version: '1.0.0',
      hookOwner: {
        username: user.name,
      },
      payload: manifest,
      change: hookEvent.change,
      time: hookEvent.time,
    };
  }
}
