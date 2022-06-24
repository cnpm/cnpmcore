import { AccessLevel, ContextProto } from '@eggjs/tegg';
import { ModelConvertor } from './util/ModelConvertor';
import { Change as ChangeModel } from './model/Change';
import { Change as ChangeEntity } from '../core/entity/Change';
import { AbstractRepository } from './AbstractRepository';

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class ChangeRepository extends AbstractRepository {
  async addChange(change: ChangeEntity) {
    await ModelConvertor.convertEntityToModel(change, ChangeModel);
  }

  async query(since: number, limit: number): Promise<Array<ChangeEntity>> {
    const models = await ChangeModel.find({ id: { $gte: since } }).order('id', 'asc').limit(limit);
    return models.toObject() as ChangeEntity[];
  }

  async getLastChange() {
    return await ChangeModel.findOne().order('id', 'desc').limit(1);
  }
}
