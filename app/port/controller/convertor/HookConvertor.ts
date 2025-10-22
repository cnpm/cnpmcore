import type { Hook } from '../../../core/entity/Hook.ts';
import type { TriggerHookTask } from '../../../core/entity/Task.ts';
import type { User } from '../../../core/entity/User.ts';
import type { HookType } from '../../../common/enum/Hook.ts';

export interface HookVo {
  id: string;
  username: string;
  name: string;
  endpoint: string;
  secret: string;
  type: HookType;
  created: Date;
  updated: Date;
  delivered: boolean;
  last_delivery: Date | null;
  response_code: number;
  status: 'active';
}

export interface DeleteHookVo {
  id: string;
  username: string;
  name: string;
  endpoint: string;
  secret: string;
  type: HookType;
  created: Date;
  updated: Date;
  delivered: boolean;
  last_delivery: Date | null;
  response_code: number;
  status: 'active';
  deleted: boolean;
}

export class HookConvertor {
  static convertToHookVo(
    hook: Hook,
    user: User,
    task?: TriggerHookTask | null | undefined
  ): HookVo {
    return {
      id: hook.hookId,
      username: user.name,
      name: hook.name,
      endpoint: hook.endpoint,
      secret: hook.secret,
      type: hook.type,
      created: hook.createdAt,
      updated: hook.updatedAt,
      delivered: !!task,
      last_delivery: task?.updatedAt || null,
      response_code: task?.data.responseStatus || 0,
      status: 'active',
    };
  }

  static convertToDeleteHookVo(
    hook: Hook,
    user: User,
    task?: TriggerHookTask | null
  ): DeleteHookVo {
    const vo = HookConvertor.convertToHookVo(hook, user, task);
    return Object.assign(vo, {
      deleted: true,
    });
  }
}
