import { AccessLevel, ContextProto, Inject } from '@eggjs/tegg';
import { Hook } from '../entity/Hook';
import { HookType } from '../../common/enum/Hook';
import {
  ForbiddenError,
  NotFoundError,
} from 'egg-errors';
import { HookRepository } from '../../repository/HookRepository';
import { EggAppConfig } from 'egg';

export interface CreateHookCommand {
  type: HookType;
  ownerId: string;
  name: string;
  endpoint: string;
  secret: string;
}

export interface UpdateHookCommand {
  operatorId: string;
  hookId: string;
  endpoint: string;
  secret: string;
}

export interface DeleteHookCommand {
  operatorId: string;
  hookId: string;
}

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class HookManageService {
  @Inject()
  private readonly hookRepository: HookRepository;

  @Inject()
  private readonly config: EggAppConfig;

  get hooksLimit() {
    return this.config.cnpmcore.hooksLimit;
  }

  async createHook(cmd: CreateHookCommand): Promise<Hook> {
    const hooks = await this.hookRepository.listHooksByOwnerId(cmd.ownerId);
    // FIXME: 会有并发问题，需要有一个用户全局锁去记录
    if (hooks.length >= this.hooksLimit) {
      throw new ForbiddenError('hooks limit exceeded');
    }
    const hook = Hook.create(cmd);
    await this.hookRepository.saveHook(hook);
    return hook;
  }

  async updateHook(cmd: UpdateHookCommand): Promise<Hook> {
    const hook = await this.hookRepository.findHookById(cmd.hookId);
    if (!hook) {
      throw new NotFoundError(`hook ${cmd.hookId} not found`);
    }
    if (hook.ownerId !== cmd.operatorId) {
      throw new ForbiddenError(`hook ${cmd.hookId} not belong to ${cmd.operatorId}`);
    }
    hook.endpoint = cmd.endpoint;
    hook.secret = cmd.secret;
    await this.hookRepository.saveHook(hook);
    return hook;
  }

  async deleteHook(cmd: DeleteHookCommand): Promise<Hook> {
    const hook = await this.hookRepository.findHookById(cmd.hookId);
    if (!hook) {
      throw new NotFoundError(`hook ${cmd.hookId} not found`);
    }
    if (hook.ownerId !== cmd.operatorId) {
      throw new ForbiddenError(`hook ${cmd.hookId} not belong to ${cmd.operatorId}`);
    }
    await this.hookRepository.removeHook(cmd.hookId);
    return hook;
  }

  async listHooksByOwnerId(ownerId: string): Promise<Hook[]> {
    return await this.hookRepository.listHooksByOwnerId(ownerId);
  }

  async getHookByOwnerId(hookId: string, userId: string): Promise<Hook> {
    const hook = await this.hookRepository.findHookById(hookId);
    if (!hook) {
      throw new NotFoundError(`hook ${hookId} not found`);
    }
    if (hook.ownerId !== userId) {
      throw new ForbiddenError(`hook ${hookId} not belong to ${userId}`);
    }
    return hook;
  }
}
