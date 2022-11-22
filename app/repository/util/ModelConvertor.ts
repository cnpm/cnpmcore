import { ModelMetadataUtil } from '@eggjs/tegg-orm-decorator';
import { Bone } from 'leoric';
import { EggProtoImplClass } from '@eggjs/tegg';
import _ from 'lodash';
import { ModelConvertorUtil } from './ModelConvertorUtil';

const CREATED_AT = 'createdAt';
const UPDATED_AT = 'updatedAt';
const ID = 'id';

export class ModelConvertor {
  static async convertEntityToModel<T extends Bone>(entity: object, ModelClazz: EggProtoImplClass<T>, options?): Promise<T> {
    const metadata = ModelMetadataUtil.getModelMetadata(ModelClazz);
    if (!metadata) {
      throw new Error(`Model ${ModelClazz.name} has no metadata`);
    }
    const attributes = {};
    for (const attributeMeta of metadata.attributes) {
      const modelPropertyName = attributeMeta.propertyName;
      const entityPropertyName = ModelConvertorUtil.getEntityPropertyName(ModelClazz, modelPropertyName);
      if (entityPropertyName === UPDATED_AT || entityPropertyName === CREATED_AT || entityPropertyName === ID) continue;
      const attributeValue = _.get(entity, entityPropertyName);
      attributes[modelPropertyName] = attributeValue;
    }
    const model = await (ModelClazz as unknown as typeof Bone).create(attributes, options);
    // auto set entity id to model id
    entity[ID] = model[ID];
    // use model dates
    entity[UPDATED_AT] = model[UPDATED_AT];
    entity[CREATED_AT] = model[CREATED_AT];
    return model as T;
  }

  static convertEntityToChanges<T extends Bone>(entity: object, ModelClazz: EggProtoImplClass<T>) {
    const changes = {};
    const metadata = ModelMetadataUtil.getModelMetadata(ModelClazz);
    if (!metadata) {
      throw new Error(`Model ${ModelClazz.name} has no metadata`);
    }
    for (const attributeMeta of metadata.attributes) {
      const modelPropertyName = attributeMeta.propertyName;
      const entityPropertyName = ModelConvertorUtil.getEntityPropertyName(ModelClazz, modelPropertyName);
      if (entityPropertyName === CREATED_AT) continue;
      const attributeValue = _.get(entity, entityPropertyName);
      changes[modelPropertyName] = attributeValue;
    }
    changes[UPDATED_AT] = new Date();
    entity[UPDATED_AT] = changes[UPDATED_AT];
    return changes;
  }

  // TODO: options is QueryOptions, should let leoric export it to use
  // Find out which attributes changed and set `updatedAt` to now
  static async saveEntityToModel<T extends Bone>(entity: object, model: T, options?): Promise<boolean> {
    const ModelClazz = model.constructor as EggProtoImplClass<T>;
    const metadata = ModelMetadataUtil.getModelMetadata(ModelClazz);
    if (!metadata) {
      throw new Error(`Model ${ModelClazz.name} has no metadata`);
    }
    for (const attributeMeta of metadata.attributes) {
      const modelPropertyName = attributeMeta.propertyName;
      const entityPropertyName = ModelConvertorUtil.getEntityPropertyName(ModelClazz, modelPropertyName);
      if (entityPropertyName === CREATED_AT) continue;
      const attributeValue = _.get(entity, entityPropertyName);
      model[modelPropertyName] = attributeValue;
    }

    // 不允许设置 UPDATED_AT
    // 通过 leoric 进行更新
    model[UPDATED_AT] = undefined;
    await model.save(options);
    entity[UPDATED_AT] = model[UPDATED_AT];
    return true;
  }

  static convertModelToEntity<T>(bone: Bone, entityClazz: EggProtoImplClass<T>, data?: object): T {
    data = data || {};
    const ModelClazz = bone.constructor;
    const metadata = ModelMetadataUtil.getModelMetadata(ModelClazz);
    if (!metadata) {
      throw new Error(`Model ${ModelClazz.name} has no metadata`);
    }
    for (const attributeMeta of metadata.attributes) {
      const modelPropertyName = attributeMeta.propertyName;
      const entityPropertyName = ModelConvertorUtil.getEntityPropertyName(ModelClazz as EggProtoImplClass, modelPropertyName);
      const attributeValue = bone[attributeMeta.propertyName];
      _.set(data, entityPropertyName, attributeValue);
    }
    const model = Reflect.construct(entityClazz, [ data ]);
    return model;
  }
}
