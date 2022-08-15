import {
  Context,
  EggContext,
  HTTPBody,
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  Inject,
} from '@eggjs/tegg';
import { HookManageService } from '../../core/service/HookManageService';
import { TaskService } from '../../core/service/TaskService';
import { UserRoleManager } from '../UserRoleManager';
import { HookType } from '../../core/entity/Hook';
import { Task } from '../../core/entity/Task';
import { HookConvertor } from './convertor/HookConvertor';
import { CreateHookRequestRule, UpdateHookRequestRule } from '../typebox';

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

@HTTPController()
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
  async createHook(@Context() ctx: EggContext, @HTTPBody() req: CreateHookRequest) {
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
  async updateHook(@Context() ctx: EggContext, @HTTPParam() id: string, @HTTPBody() req: UpdateHookRequest) {
    ctx.tValidate(UpdateHookRequestRule, req);
    const user = await this.userRoleManager.requiredAuthorizedUser(ctx, 'setting');
    const hook = await this.hookManageService.updateHook({
      operatorId: user.userId,
      hookId: id,
      endpoint: req.endpoint,
      secret: req.secret,
    });
    let task: Task | null = null;
    if (hook.latestTaskId) {
      task = await this.taskService.findTask(hook.hookId);
    }
    return HookConvertor.convertToHookVo(hook, user, task);
  }

  @HTTPMethod({
    path: '/v1/hooks/hook/:id',
    method: HTTPMethodEnum.DELETE,
  })
  async deleteHook(@Context() ctx: EggContext, @HTTPParam() id: string) {
    const user = await this.userRoleManager.requiredAuthorizedUser(ctx, 'setting');
    const hook = await this.hookManageService.deleteHook({
      operatorId: user.userId,
      hookId: id,
    });
    let task: Task | null = null;
    if (hook.latestTaskId) {
      task = await this.taskService.findTask(hook.hookId);
    }
    return HookConvertor.convertToDeleteHookVo(hook, user, task);
  }

  @HTTPMethod({
    path: '/v1/hooks',
    method: HTTPMethodEnum.GET,
  })
  async listHooks(@Context() ctx: EggContext) {
    const user = await this.userRoleManager.requiredAuthorizedUser(ctx, 'read');
    const hooks = await this.hookManageService.listHooksByOwnerId(user.userId);
    const tasks = await this.taskService.findTasks(hooks.map(t => t.hookId));
    return hooks.map(hook => {
      const task = tasks.find(t => t.taskId === hook.latestTaskId);
      return HookConvertor.convertToHookVo(hook, user, task);
    });
  }

  @HTTPMethod({
    path: '/v1/hooks/hook/:id',
    method: HTTPMethodEnum.GET,
  })
  async getHook(@Context() ctx: EggContext, @HTTPParam() id: string) {
    const user = await this.userRoleManager.requiredAuthorizedUser(ctx, 'read');
    const hook = await this.hookManageService.getHookByOwnerId(id, user.userId);
    let task: Task | null = null;
    if (hook.latestTaskId) {
      task = await this.taskService.findTask(hook.hookId);
    }
    return HookConvertor.convertToHookVo(hook, user, task);
  }
}
