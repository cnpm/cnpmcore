import { AccessLevel, SingletonProto, Inject } from '@eggjs/tegg';

import { ModelConvertor } from './util/ModelConvertor.js';
import type { Change as ChangeModel } from './model/Change.js';
import type { Change as ChangeEntity } from '../core/entity/Change.js';
import { AbstractRepository } from './AbstractRepository.js';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class ChangeRepository extends AbstractRepository {
  @Inject()
  private readonly Change: typeof ChangeModel;

  async addChange(change: ChangeEntity) {
    await ModelConvertor.convertEntityToModel(change, this.Change);
  }

  async query(since: number, limit: number): Promise<Array<ChangeEntity>> {
    const models = await this.Change.find({ id: { $gte: since } })
      .order('id', 'asc')
      .limit(limit);
    return models.toObject() as ChangeEntity[];
  }

  async getLastChange() {
    return await this.Change.findOne().order('id', 'desc').limit(1);
  }
}
