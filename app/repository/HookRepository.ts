import { AccessLevel, ContextProto, Inject } from '@eggjs/tegg';
import { Hook } from '../core/entity/Hook';
import type { Hook as HookModel } from './model/Hook';
import { ModelConvertor } from './util/ModelConvertor';

export interface UpdateHookCommand {
  hookId: string;
  endpoint: string;
  secret: string;
}

@ContextProto({
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
    return ModelConvertor.convertModelToEntity(model, this.Hook);
  }

  async removeHook(hookId: string): Promise<void> {
    await this.Hook.remove({ hookId });
  }

  /**
   * only endpoint and secret can be updated
   */
  async updateHook(cmd: UpdateHookCommand) {
    this.Hook.update({
      hookId: cmd.hookId,
    }, {
      endpoint: cmd.endpoint,
      secret: cmd.secret,
    });
  }

  async listHooksByOwnerId(ownerId: string) {
    const hookRows = await this.Hook.find({ ownerId });
    return hookRows.map(row => ModelConvertor.convertModelToEntity(row, Hook));
  }
}
