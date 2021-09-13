import { ModelMetadataUtil } from '@eggjs/tegg-orm-decorator';
import { Bone } from 'leoric';
import { ModelConvertorUtil } from './ModelConvertorUtil';
import { EggProtoImplClass } from '@eggjs/tegg';
import _ from 'lodash';

export class ModelConvertor {
  static async convertEntityToModel<T extends Bone>(entity: object, ModelClazz: EggProtoImplClass<T>, options?): Promise<T> {
    const metadata = ModelMetadataUtil.getControllerMetadata(ModelClazz);
    if (!metadata) {
      throw new Error(`Model ${ModelClazz.name} has no metadata`);
    }
    const attributes = {};
    for (const attributeMeta of metadata.attributes) {
      const modelPropertyName = attributeMeta.propertyName;
      const entityPropertyName = ModelConvertorUtil.getEntityPropertyName(ModelClazz, modelPropertyName);
      const attributeValue = _.get(entity, entityPropertyName);
      attributes[modelPropertyName] = attributeValue;
    }
    const model = await (ModelClazz as unknown as typeof Bone).create(attributes, options);
    return model as T;
  }

  static convertModelToEntity<T>(bone: Bone, entityClazz: EggProtoImplClass<T>, data?: object): T {
    data = data || {};
    const ModelClazz = bone.constructor;
    const metadata = ModelMetadataUtil.getControllerMetadata(ModelClazz);
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
