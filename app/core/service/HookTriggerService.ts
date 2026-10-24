import { AccessLevel, Inject, SingletonProto, HttpClient, Config } from 'egg';

import { TaskState } from '../../common/enum/Task.ts';
import { isoNow } from '../../common/LogUtil.ts';
import { getScopeAndName } from '../../common/PackageUtil.ts';
import {
  assertSafeWebhookEndpoint,
  getWebhookDispatcher,
  type WebhookNetworkOptions,
} from '../../common/WebhookUrlUtil.ts';
import type { DistRepository } from '../../repository/DistRepository.ts';
import type { HookRepository } from '../../repository/HookRepository.ts';
import type { PackageRepository } from '../../repository/PackageRepository.ts';
import type { UserRepository } from '../../repository/UserRepository.ts';
import type { Dist } from '../entity/Dist.ts';
import type { Hook } from '../entity/Hook.ts';
import type { HookEvent } from '../entity/HookEvent.ts';
import type { TriggerHookTask } from '../entity/Task.ts';
import type { TaskService } from './TaskService.ts';

@SingletonProto({
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
  private readonly httpClient: HttpClient;

  @Inject()
  private readonly taskService: TaskService;

  @Inject()
  private readonly config: Config;

  private get webhookNetworkOptions(): WebhookNetworkOptions {
    const { hookAllowPrivateNetwork, hookAllowedHosts, hookAllowedCIDRs } = this.config.cnpmcore;
    return {
      allowPrivateNetwork: hookAllowPrivateNetwork,
      allowedHosts: hookAllowedHosts,
      allowedCIDRs: hookAllowedCIDRs,
    };
  }

  async executeTask(task: TriggerHookTask) {
    const { hookId, hookEvent } = task.data;
    const hook = await this.hookRepository.findHookById(hookId);
    if (!hook) {
      await this.taskService.finishTask(
        task,
        TaskState.Success,
        `[${isoNow()}][TriggerHooks] hook ${hookId} not exits`,
      );
      return;
    }
    try {
      const payload = await this.createTriggerPayload(task, hookEvent, hook);
      if (!payload) {
        await this.taskService.finishTask(
          task,
          TaskState.Success,
          `[${isoNow()}][TriggerHooks] generate payload failed \n`,
        );
        return;
      }
      const status = await this.doExecuteTrigger(hook, payload);
      hook.latestTaskId = task.taskId;
      task.data.responseStatus = status;
      await this.hookRepository.saveHook(hook);
      await this.taskService.finishTask(
        task,
        TaskState.Success,
        `[${isoNow()}][TriggerHooks] trigger hook succeed ${status} \n`,
      );
    } catch (e) {
      e.message = `trigger hook failed: ${e.message}`;
      task.error = e.message;
      await this.taskService.finishTask(task, TaskState.Fail, `[${isoNow()}][TriggerHooks] ${e.stack} \n`);
      return;
    }
  }

  async doExecuteTrigger(hook: Hook, payload: object): Promise<number> {
    const networkOptions = this.webhookNetworkOptions;
    assertSafeWebhookEndpoint(hook.endpoint, networkOptions);
    const { digest, payloadStr } = hook.signPayload(payload);
    const url = new URL(hook.endpoint);
    const res = await this.httpClient.request(hook.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-npm-signature': `sha256=${digest}`,
        host: url.host,
      },
      // webhook 场景下，由于 endpoint 都不同
      // 因此几乎不存在连接复用的情况，因此这里不使用 keepAlive
      // agent: false,
      // httpsAgent: false,
      data: payloadStr,
      // never follow redirects; unless allowed by config, refuse private/loopback addresses after DNS resolution
      followRedirect: false,
      dispatcher: getWebhookDispatcher(hook.endpoint, networkOptions),
    });
    if (res.status >= 200 && res.status < 300) {
      return res.status;
    }
    throw new Error(`hook response with ${res.status}`);
  }

  async createTriggerPayload(task: TriggerHookTask, hookEvent: HookEvent, hook: Hook): Promise<object | undefined> {
    const [scope, name] = getScopeAndName(hookEvent.fullname);
    const pkg = await this.packageRepository.findPackage(scope, name);
    if (!pkg) {
      await this.taskService.finishTask(
        task,
        TaskState.Success,
        `[${isoNow()}][TriggerHooks] can not found pkg for ${hookEvent.fullname} \n`,
      );
      return;
    }
    const user = await this.userRepository.findUserByUserId(hook.ownerId);
    if (!user) {
      await this.taskService.finishTask(
        task,
        TaskState.Success,
        `[${isoNow()}][TriggerHooks] can not found user for ${hook.ownerId} \n`,
      );
      return;
    }
    const manifest = await this.distRepository.readDistBytesToJSON(pkg.manifestsDist as Dist);
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
