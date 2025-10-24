import { randomUUID } from 'node:crypto';

import {
  type Context,
  AccessLevel,
  Inject,
  SingletonProto,
} from 'egg';
import type { Redis } from 'ioredis';

import type {
  AuthClient,
  AuthUrlResult,
  userResult,
} from '../common/typing.ts';

const ONE_DAY = 3600 * 24;

interface SSO_USER {
  name: string;
  email: string;
}

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

  async getAuthUrl(ctx: Context): Promise<AuthUrlResult> {
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
