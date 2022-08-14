import { Registry } from 'app/core/entity/Registry';
import { CnpmjsOrgRegistry } from './CnpmjsOrgRegistry';
import { CnpmcoreRegistry } from './CnpmcoreRegistry';
import { NpmRegistry } from './NpmRegistry';
import { AbstractRegistry } from './AbstractRegistry';
import { RegistryType } from 'app/common/enum/registry';

const REGISTRY_TYPE_MAP: Record<RegistryType, typeof AbstractRegistry> = {
  cnpmjsorg: CnpmjsOrgRegistry,
  cnpmcore: CnpmcoreRegistry,
  npm: NpmRegistry,
};

export function getRegistryAdapter(registry: Registry) {
  const target = REGISTRY_TYPE_MAP[registry.type];
  if (!target) {
    throw new Error(`Registry type ${registry.type} not supported`);
  }
  return target;
}
