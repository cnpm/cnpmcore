import { AccessLevel, Inject, SingletonProto } from 'egg';

import { Hook } from '../core/entity/Hook.ts';
import type { Hook as HookModel } from './model/Hook.ts';
import { ModelConvertor } from './util/ModelConvertor.ts';
import type { HookType } from '../common/enum/Hook.ts';

export interface UpdateHookCommand {
  hookId: string;
  endpoint: string;
  secret: string;
}

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class HookRepository {
  @Inject()
  private readonly Hook: typeof HookModel;

  async saveHook(hook: Hook) {
    if (hook.id) {
      const model = await this.Hook.findOne({ id: hook.id });
      if (!model) return;
      await ModelConvertor.saveEntityToModel(hook, model);
    } else {
      await ModelConvertor.convertEntityToModel(hook, this.Hook);
    }
  }

  async findHookById(hookId: string): Promise<Hook | undefined> {
    const model = await this.Hook.findOne({ hookId });
    if (!model) return;
    return ModelConvertor.convertModelToEntity(model, Hook);
  }

  async removeHook(hookId: string): Promise<void> {
    await this.Hook.remove({ hookId });
  }

  /**
   * only endpoint and secret can be updated
   */
  async updateHook(cmd: UpdateHookCommand) {
    this.Hook.update(
      {
        hookId: cmd.hookId,
      },
      {
        endpoint: cmd.endpoint,
        secret: cmd.secret,
      }
    );
  }

  async listHooksByOwnerId(ownerId: string) {
    const hookRows = await this.Hook.find({ ownerId });
    return hookRows.map(row => ModelConvertor.convertModelToEntity(row, Hook));
  }

  async listHooksByTypeAndName(
    type: HookType,
    name: string,
    since?: bigint
  ): Promise<Hook[]> {
    let hookRows: HookModel[];
    if (since === undefined) {
      hookRows = await this.Hook.find({ type, name }).limit(100);
    } else {
      hookRows = await this.Hook.find({ type, name, id: { $gt: since } }).limit(
        100
      );
    }
    return hookRows.map(row => ModelConvertor.convertModelToEntity(row, Hook));
  }
}
