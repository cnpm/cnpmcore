import { getScopeAndName } from '../../../common/PackageUtil';
import { Registry } from '../../../core/entity/Registry';
import { Scope } from '../../../core/entity/Scope';
import { Task } from '../../../core/entity/Task';
import { EggContextHttpClient, EggLogger } from 'egg';
import type { PackageSyncerService } from '../../../core/service/PackageSyncerService';

export type FetchResult = {
  data: any;
  status: number;
  since?: string;
};

export type HandleResult = {
  taskData: {
    lastSince: string;
    last_package: string;
    last_package_created: Date;
    task_count: number;
    sync_count: number;
  } | {};
  lastSince: string;
  taskCount: number;
  syncCount: number;
};

export type RegistryWithScopes = Registry & { scopes: Scope[] };

export abstract class AbstractRegistry {
  protected registry: RegistryWithScopes;
  protected httpclient: EggContextHttpClient;
  protected logger: EggLogger;
  protected fullScopes: string[];

  constructor(httpclient: EggContextHttpClient, logger: EggLogger, registry: RegistryWithScopes, fullScopes: string[] = []) {
    this.httpclient = httpclient;
    this.logger = logger;
    this.registry = registry;
    this.fullScopes = fullScopes;
  }

  // check need handle the change task
  needSync(scopes: Scope[], pkgName: string) {
    const [ scope ] = getScopeAndName(pkgName);
    // common package registry
    if (scopes.length === 0) {
      // should not be conflict with other registry
      return this.fullScopes.every(otherScope => otherScope !== scope);
    }

    // scoped registries
    if (!scope) {
      return false;
    }

    return scopes.some(s => s.name === scope);
  }


  abstract fetch(since: string): Promise<FetchResult>;
  abstract handleChanges(since: string, taskData: Task['data'], packageSyncerService: PackageSyncerService): Promise<HandleResult>;

}
