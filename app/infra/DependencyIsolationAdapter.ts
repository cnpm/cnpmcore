import {
  AccessLevel,
  Inject,
  SingletonProto,
} from '@eggjs/tegg';
import { EggAppConfig } from 'egg';
import { createDefaultDependencyIsolationPolicy } from '../common/DependencyIsolationUtil';
import {
  DependencyIsolationClient,
  DependencyIsolationContext,
  DependencyIsolationPolicy,
} from '../common/typing';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
  name: 'dependencyIsolationAdapter',
})
export class DependencyIsolationAdapter implements DependencyIsolationClient {
  @Inject()
  private readonly config: EggAppConfig;

  async ensureDependencyIsolation(
    context: DependencyIsolationContext,
  ): Promise<DependencyIsolationPolicy | null> {
    void context;
    return createDefaultDependencyIsolationPolicy(this.config.cnpmcore.dependencyIsolationDuration);
  }
}
