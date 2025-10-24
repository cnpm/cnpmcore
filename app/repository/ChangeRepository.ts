import { AccessLevel, Inject, SingletonProto } from 'egg';

import { ModelConvertor } from './util/ModelConvertor.ts';
import type { Change as ChangeModel } from './model/Change.ts';
import type { Change as ChangeEntity } from '../core/entity/Change.ts';
import { AbstractRepository } from './AbstractRepository.ts';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class ChangeRepository extends AbstractRepository {
  @Inject()
  private readonly Change: typeof ChangeModel;

  async addChange(change: ChangeEntity) {
    await ModelConvertor.convertEntityToModel(change, this.Change);
  }

  async query(since: number, limit: number): Promise<ChangeEntity[]> {
    const models = await this.Change.find({ id: { $gte: since } })
      .order('id', 'asc')
      .limit(limit);
    return models.toObject() as ChangeEntity[];
  }

  async getLastChange() {
    return await this.Change.findOne().order('id', 'desc').limit(1);
  }
}
