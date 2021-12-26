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

  async query(since: number, limit: number) {
    return await ChangeModel.find({ id: { $gt: since } }).order('id', 'desc').limit(limit);
  }
}
