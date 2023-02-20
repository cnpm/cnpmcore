import {
  AccessLevel,
  EggContext,
  Inject,
  SingletonProto,
} from '@eggjs/tegg';
import { Redis } from 'ioredis';
import { randomUUID } from 'crypto';
import { AuthClient, AuthUrlResult, userResult } from '../common/typing';

const ONE_DAY = 3600 * 24;

/**
 * Use sort set to keep queue in order and keep same value only insert once
 */
@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
  name: 'authAdapter',
})
export class AuthAdapter implements AuthClient {
  @Inject()
  readonly redis: Redis;

  @Inject()
  readonly user: any;

  async getAuthUrl(ctx: EggContext): Promise<AuthUrlResult> {
    const sessionId = randomUUID();
    await this.redis.setex(sessionId, ONE_DAY, '');
    return {
      loginUrl: `${ctx.href}/request/session/${sessionId}`,
      doneUrl: `${ctx.href}/done/session/${sessionId}`,
    };
  }

  // should implements in infra
  async ensureCurrentUser() {
    if (this.user) {
      const { name, email } = this.user;
      return { name, email } as userResult;
    }
    return null;
  }

}
