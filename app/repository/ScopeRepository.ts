import { AccessLevel, ContextProto, Inject } from '@eggjs/tegg';
import { ModelConvertor } from './util/ModelConvertor';
import { AbstractRepository } from './AbstractRepository';
import { Scope as ScopeModel } from './model/Scope';
import { Scope } from '../core/entity/Scope';
import { EntityUtil, PageOptions, PageResult } from '../core/util/EntityUtil';

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class ScopeRepository extends AbstractRepository {
  @Inject()
  private readonly Scope: typeof ScopeModel;

  async listScopesByRegistryId(registryId: string, page: PageOptions): Promise<PageResult<Scope>> {
    const { offset, limit } = EntityUtil.convertPageOptionsToLimitOption(page);
    const count = await this.Scope.find({ registryId }).count();
    const models = await this.Scope.find({ registryId }).offset(offset).limit(limit);
    return {
      count,
      data: models.map(model => ModelConvertor.convertModelToEntity(model, Scope)),
    };
  }

  async listScopes(page: PageOptions): Promise<PageResult<Scope>> {
    const { offset, limit } = EntityUtil.convertPageOptionsToLimitOption(page);
    const count = await this.Scope.find().count();
    const models = await this.Scope.find().offset(offset).limit(limit);
    return {
      count,
      data: models.map(model => ModelConvertor.convertModelToEntity(model, Scope)),
    };
  }

  async saveScope(scope: Scope) {
    if (scope.id) {
      const model = await this.Scope.findOne({ id: scope.id });
      if (!model) return;
      await ModelConvertor.saveEntityToModel(scope, model);
      return model;
    }
    const model = await ModelConvertor.convertEntityToModel(scope, this.Scope);
    this.logger.info('[ScopeRepository:saveScope:new] id: %s, scopeId: %s',
      model.id, model.scopeId);
    await model.save();
    return model;
  }

  async removeScope(scopeId: string): Promise<void> {
    await this.Scope.remove({ scopeId });
  }

  async removeScopeByRegistryId(registryId: string): Promise<void> {
    await this.Scope.remove({ registryId });
  }

}
