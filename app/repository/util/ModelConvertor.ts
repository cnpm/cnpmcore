import { ModelMetadataUtil } from '@eggjs/tegg/orm';
import type { EggProtoImplClass } from '@eggjs/tegg';
import { get as lodashGet, set as lodashSet } from 'lodash-es';

import { ModelConvertorUtil } from './ModelConvertorUtil.js';
import { type LeoricBone, type Bone } from './leoric.js';

const CREATED_AT = 'createdAt';
const UPDATED_AT = 'updatedAt';
const ID = 'id';

interface BonePatchInfo {
  id?: bigint;
  updatedAt?: Date;
  createdAt?: Date;
}
type PatchedBone = LeoricBone & BonePatchInfo;

export class ModelConvertor {
  static async convertEntityToModel<T extends PatchedBone>(
    entity: object,
    ModelClazz: EggProtoImplClass<T>,
    options?: object
  ): Promise<T> {
    const metadata = ModelMetadataUtil.getModelMetadata(ModelClazz);
    if (!metadata) {
      throw new Error(`Model ${ModelClazz.name} has no metadata`);
    }
    const attributes: Record<string, unknown> = {};
    for (const attributeMeta of metadata.attributes) {
      const modelPropertyName = attributeMeta.propertyName;
      const entityPropertyName = ModelConvertorUtil.getEntityPropertyName(
        ModelClazz,
        modelPropertyName
      );
      if (
        entityPropertyName === UPDATED_AT ||
        entityPropertyName === CREATED_AT ||
        entityPropertyName === ID
      )
        continue;
      const attributeValue = lodashGet(entity, entityPropertyName);
      attributes[modelPropertyName] = attributeValue;
    }
    const model = (await (ModelClazz as unknown as typeof Bone).create(
      attributes,
      options
    )) as PatchedBone;
    // auto set entity id to model id
    (entity as Record<string, unknown>)[ID] = model[ID];
    // use model dates
    (entity as Record<string, unknown>)[UPDATED_AT] = model[UPDATED_AT];
    (entity as Record<string, unknown>)[CREATED_AT] = model[CREATED_AT];
    return model as T;
  }

  static convertEntityToChanges<T extends LeoricBone>(
    entity: object,
    ModelClazz: EggProtoImplClass<T>
  ) {
    const changes: Record<string, unknown> = {};
    const metadata = ModelMetadataUtil.getModelMetadata(ModelClazz);
    if (!metadata) {
      throw new Error(`Model ${ModelClazz.name} has no metadata`);
    }
    for (const attributeMeta of metadata.attributes) {
      const modelPropertyName = attributeMeta.propertyName;
      const entityPropertyName = ModelConvertorUtil.getEntityPropertyName(
        ModelClazz,
        modelPropertyName
      );
      if (entityPropertyName === CREATED_AT) continue;
      const attributeValue = lodashGet(entity, entityPropertyName);
      changes[modelPropertyName] = attributeValue;
    }
    changes[UPDATED_AT] = new Date();
    (entity as Record<string, unknown>)[UPDATED_AT] = changes[UPDATED_AT];
    return changes;
  }

  // TODO: options is QueryOptions, should let leoric export it to use
  // Find out which attributes changed and set `updatedAt` to now
  static async saveEntityToModel<T extends LeoricBone>(
    entity: object,
    model: T & PatchedBone,
    options?: object
  ): Promise<boolean> {
    const ModelClazz = model.constructor as EggProtoImplClass<T>;
    const metadata = ModelMetadataUtil.getModelMetadata(ModelClazz);
    if (!metadata) {
      throw new Error(`Model ${ModelClazz.name} has no metadata`);
    }
    for (const attributeMeta of metadata.attributes) {
      const modelPropertyName = attributeMeta.propertyName;
      const entityPropertyName = ModelConvertorUtil.getEntityPropertyName(
        ModelClazz,
        modelPropertyName
      );
      if (entityPropertyName === CREATED_AT) continue;
      // Restricted updates to the primary key
      if (entityPropertyName === ID && model[ID]) continue;
      const attributeValue = lodashGet(entity, entityPropertyName);
      (model as unknown as Record<string, unknown>)[modelPropertyName] =
        attributeValue;
    }

    // Restricted updates to the UPDATED_AT
    // Leoric will set by default
    model[UPDATED_AT] = undefined;
    await model.save(options);
    (entity as Record<string, unknown>)[UPDATED_AT] = model[UPDATED_AT];
    return true;
  }

  static convertModelToEntity<T>(
    bone: LeoricBone,
    entityClazz: EggProtoImplClass<T>,
    data?: object
  ): T {
    data = data || {};
    const ModelClazz = bone.constructor as EggProtoImplClass;
    const metadata = ModelMetadataUtil.getModelMetadata(ModelClazz);
    if (!metadata) {
      throw new Error(`Model ${ModelClazz.name} has no metadata`);
    }
    for (const attributeMeta of metadata.attributes) {
      const modelPropertyName = attributeMeta.propertyName;
      const entityPropertyName = ModelConvertorUtil.getEntityPropertyName(
        ModelClazz,
        modelPropertyName
      );
      const attributeValue =
        bone[attributeMeta.propertyName as keyof LeoricBone];
      lodashSet(data, entityPropertyName, attributeValue);
    }
    const model = Reflect.construct(entityClazz, [data]);
    return model;
  }
}
