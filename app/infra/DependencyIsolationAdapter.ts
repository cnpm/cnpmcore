import {
  AccessLevel,
  Inject,
  SingletonProto,
} from '@eggjs/tegg';
import { EggAppConfig } from 'egg';
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
    const duration = this.config.cnpmcore.dependencyIsolationDuration;
    if (!duration || duration <= 0) return null;

    const expiredAt = new Date(Date.now() + duration);
    return {
      expiredAt,
      reason: `[buffer] in dependency isolation zone, release at ${expiredAt.toISOString()}`,
    };
  }
}
