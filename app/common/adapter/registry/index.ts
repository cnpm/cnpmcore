import { Registry } from "app/core/entity/Registry";
import { CnpmjsOrgRegistry } from "./CnpmjsOrgRegistry";
import { NpmcoreRegistry } from "./NpmcoreRegistry";
import { NpmRegistry } from "./NpmRegistry";

const REGISTRY_TYPE_MAP = {
  cnpmjsorg: CnpmjsOrgRegistry,
  npmcore: NpmcoreRegistry,
  NpmRegistry: NpmRegistry,
};

export function getRegistryAdapter(registry: Registry) {
  return REGISTRY_TYPE_MAP[registry.type];
}
