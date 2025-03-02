import {
  AccessLevel,
  EggContext,
  Inject,
  SingletonProto,
} from '@eggjs/tegg';
import { Redis } from 'ioredis';
import { randomUUID } from 'node:crypto';

import { AuthClient, AuthUrlResult, userResult } from '../common/typing.js';

const ONE_DAY = 3600 * 24;

type SSO_USER = {
  name: string;
  email: string;
};

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
  readonly user: SSO_USER;

  async getAuthUrl(ctx: EggContext): Promise<AuthUrlResult> {
    const sessionId = randomUUID();
    await this.redis.setex(sessionId, ONE_DAY, '');

    // INTEGRATE.md
    const registry = ctx.app.config.cnpmcore.registry;
    return {
      loginUrl: `${registry}/-/v1/login/request/session/${sessionId}`,
      doneUrl: `${registry}/-/v1/login/done/session/${sessionId}`,
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
