import { AccessLevel, ContextProto } from '@eggjs/tegg';
import { ModelConvertor } from './util/ModelConvertor';
import { UpstreamChange as UpstreamChangeEntity } from '../core/entity/UpstreamChange';
import { UpstreamChange as UpstreamChangeModel } from './model/UpstreamChange';

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class UpstreamRepository {
  async createUpstreamChange(upstreamChangeEntity: UpstreamChangeEntity): Promise<UpstreamChangeEntity> {
    const model = await ModelConvertor.convertEntityToModel(upstreamChangeEntity, UpstreamChangeModel);
    // FIXME: id、gmtCreate、gmtModified 应该自动设置
    upstreamChangeEntity.id = model.id;
    return upstreamChangeEntity;
  }

  async findLastUpstreamChange(): Promise<UpstreamChangeEntity | null> {
    const model = await UpstreamChangeModel.last as UpstreamChangeModel;
    if (!model) return null;
    const entity = ModelConvertor.convertModelToEntity(model, UpstreamChangeEntity);
    return entity;
  }
}
