import assert from 'assert';
import { EggProtoImplClass } from '@eggjs/tegg';
import { ModelConvertorUtil } from './ModelConvertorUtil';

export function EntityProperty(entityProperty: string) {
  return function(target: any, modelProperty: PropertyKey) {
    const clazz = target.constructor as EggProtoImplClass;
    assert(typeof modelProperty === 'string',
      `[model/${clazz.name}] expect method name be typeof string, but now is ${String(modelProperty)}`);
    ModelConvertorUtil.addEntityPropertyName(entityProperty, clazz, modelProperty as string);
  };
}

