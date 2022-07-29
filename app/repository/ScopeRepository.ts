import { AccessLevel, ContextProto, Inject } from '@eggjs/tegg';
import { ModelConvertor } from './util/ModelConvertor';
import { AbstractRepository } from './AbstractRepository';
import type { Scope as ScopeModel } from './model/Scope';
import { Scope } from '../core/entity/Scope';

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class ScopeRepository extends AbstractRepository {
  @Inject()
  private readonly Scope: typeof ScopeModel;

  async listScopesByRegistryId(registryId: string): Promise<Scope[]> {
    const models = await this.Scope.find({ registryId });
    return models.map(model => ModelConvertor.convertModelToEntity(model, Scope));
  }

  async saveScope(scope: Scope) {
    if (scope.id) {
      const model = await this.Scope.findOne({ id: scope.id });
      if (!model) return;
      await ModelConvertor.saveEntityToModel(scope, model);
    } else {
      const model = await ModelConvertor.convertEntityToModel(scope, this.Scope);
      this.logger.info('[ScopeRepository:saveScope:new] id: %s, scopeId: %s',
        model.id, model.scopeId);
      await model.save();
    }
  }

  async removeScope(scopeId: string): Promise<void> {
    await this.Scope.remove({ scopeId });
  }

}
