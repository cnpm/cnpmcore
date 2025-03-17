import assert from 'node:assert';
import type { EggProtoImplClass } from '@eggjs/tegg';

import { ModelConvertorUtil } from './ModelConvertorUtil.js';

export function EntityProperty(entityProperty: string) {
  // oxlint-disable-next-line typescript-eslint/no-explicit-any
  return (target: any, modelProperty: PropertyKey) => {
    const clazz = target.constructor as EggProtoImplClass;
    assert(
      typeof modelProperty === 'string',
      `[model/${clazz.name}] expect method name be typeof string, but now is ${String(modelProperty)}`
    );
    ModelConvertorUtil.addEntityPropertyName(
      entityProperty,
      clazz,
      modelProperty as string
    );
  };
}
