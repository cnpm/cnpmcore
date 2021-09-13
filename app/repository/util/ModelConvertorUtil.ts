import { EggProtoImplClass, MetadataUtil } from '@eggjs/tegg';

const ENTITY_PROPERTY_MAP_ATTRIBUTE = Symbol.for('EggPrototype#model#entityPropertyMap');

export class ModelConvertorUtil {
  static addEntityPropertyName(entityProperty: string, clazz: EggProtoImplClass, modelProperty: string) {
    const propertyMap: Map<string, string> = MetadataUtil.initOwnMapMetaData(ENTITY_PROPERTY_MAP_ATTRIBUTE, clazz, new Map());
    propertyMap.set(modelProperty, entityProperty);
  }

  /**
   * If has no entity property info, use modelProperty as default value
   */
  static getEntityPropertyName(clazz: EggProtoImplClass, modelProperty: string): string {
    const propertyMap: Map<string, string> | undefined = MetadataUtil.getOwnMetaData(ENTITY_PROPERTY_MAP_ATTRIBUTE, clazz);
    return propertyMap?.get(modelProperty) ?? modelProperty;
  }
}
