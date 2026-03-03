import type { Static } from '@eggjs/typebox-validate/typebox';
import {
  HTTPContext,
  Context,
  HTTPBody,
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  HTTPQuery,
  Inject,
} from 'egg';

import type { HookType } from '../../common/enum/Hook.ts';
import type { TriggerHookTask } from '../../core/entity/Task.ts';
import type { HookManageService } from '../../core/service/HookManageService.ts';
import type { TaskService } from '../../core/service/TaskService.ts';
import { CreateHookRequestRule, UpdateHookRequestRule, ListHookQueryOptions } from '../typebox.ts';
import type { UserRoleManager } from '../UserRoleManager.ts';
import { HookConvertor } from './convertor/HookConvertor.ts';

export interface CreateHookRequest {
  type: string;
  name: string;
  endpoint: string;
  secret: string;
}

export interface UpdateHookRequest {
  endpoint: string;
  secret: string;
}

@HTTPController({
  path: '/-/npm',
})
export class HookController {
  @Inject()
  private readonly hookManageService: HookManageService;

  @Inject()
  private readonly taskService: TaskService;

  @Inject()
  private readonly userRoleManager: UserRoleManager;

  @HTTPMethod({
    path: '/v1/hooks/hook',
    method: HTTPMethodEnum.POST,
  })
  async createHook(@HTTPContext() ctx: Context, @HTTPBody() req: CreateHookRequest) {
    ctx.tValidate(CreateHookRequestRule, req);
    const user = await this.userRoleManager.requiredAuthorizedUser(ctx, 'setting');
    const hook = await this.hookManageService.createHook({
      ownerId: user.userId,
      type: req.type as HookType,
      name: req.name,
      endpoint: req.endpoint,
      secret: req.secret,
    });
    return HookConvertor.convertToHookVo(hook, user);
  }

  @HTTPMethod({
    path: '/v1/hooks/hook/:id',
    method: HTTPMethodEnum.PUT,
  })
  async updateHook(@HTTPContext() ctx: Context, @HTTPParam() id: string, @HTTPBody() req: UpdateHookRequest) {
    ctx.tValidate(UpdateHookRequestRule, req);
    const user = await this.userRoleManager.requiredAuthorizedUser(ctx, 'setting');
    const hook = await this.hookManageService.updateHook({
      operatorId: user.userId,
      hookId: id,
      endpoint: req.endpoint,
      secret: req.secret,
    });
    let task: TriggerHookTask | null = null;
    if (hook.latestTaskId) {
      task = (await this.taskService.findTask(hook.latestTaskId)) as TriggerHookTask;
    }
    return HookConvertor.convertToHookVo(hook, user, task);
  }

  @HTTPMethod({
    path: '/v1/hooks/hook/:id',
    method: HTTPMethodEnum.DELETE,
  })
  async deleteHook(@HTTPContext() ctx: Context, @HTTPParam() id: string) {
    const user = await this.userRoleManager.requiredAuthorizedUser(ctx, 'setting');
    const hook = await this.hookManageService.deleteHook({
      operatorId: user.userId,
      hookId: id,
    });
    let task: TriggerHookTask | null = null;
    if (hook.latestTaskId) {
      task = (await this.taskService.findTask(hook.latestTaskId)) as TriggerHookTask;
    }
    return HookConvertor.convertToDeleteHookVo(hook, user, task);
  }

  @HTTPMethod({
    path: '/v1/hooks',
    method: HTTPMethodEnum.GET,
  })
  async listHooks(
    @HTTPContext() ctx: Context,
    @HTTPQuery({ name: 'package' }) packageName: Static<typeof ListHookQueryOptions>['package'],
    @HTTPQuery() offset: Static<typeof ListHookQueryOptions>['offset'],
    @HTTPQuery() limit: Static<typeof ListHookQueryOptions>['limit'],
  ) {
    const user = await this.userRoleManager.requiredAuthorizedUser(ctx, 'read');
    let hooks = await this.hookManageService.listHooksByOwnerId(user.userId);

    // Filter by package name (npm spec: ?package=lodash)
    if (packageName) {
      hooks = hooks.filter((hook) => hook.name === packageName);
    }

    // Pagination (npm spec: ?limit=N&offset=N)
    const offsetNum = offset ?? 0;
    if (offsetNum > 0 || limit !== undefined) {
      hooks = hooks.slice(offsetNum, limit !== undefined ? offsetNum + limit : undefined);
    }

    const tasks = await this.taskService.findTasks(hooks.map((t) => t.latestTaskId).filter((t): t is string => !!t));
    const res = hooks.map((hook) => {
      const task = tasks.find((t) => t.taskId === hook.latestTaskId) as TriggerHookTask;
      return HookConvertor.convertToHookVo(hook, user, task);
    });
    return {
      objects: res,
    };
  }

  @HTTPMethod({
    path: '/v1/hooks/hook/:id',
    method: HTTPMethodEnum.GET,
  })
  async getHook(@HTTPContext() ctx: Context, @HTTPParam() id: string) {
    const user = await this.userRoleManager.requiredAuthorizedUser(ctx, 'read');
    const hook = await this.hookManageService.getHookByOwnerId(id, user.userId);
    let task: TriggerHookTask | null = null;
    if (hook.latestTaskId) {
      task = (await this.taskService.findTask(hook.latestTaskId)) as TriggerHookTask;
    }
    return HookConvertor.convertToHookVo(hook, user, task);
  }
}
