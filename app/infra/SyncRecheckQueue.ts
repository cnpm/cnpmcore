import { createHash, randomBytes } from 'node:crypto';

import { AccessLevel, Config, Inject, SingletonProto } from 'egg';
import type { Redis } from 'ioredis';

import type { SyncRecheckState } from '../common/SyncRecheck.ts';

const PREFIX = 'CNPMCORE_SYNC_RECHECK:';
const DUE = `${PREFIX}due`;
const HOUR = 60 * 60_000;
const LEASE = 60_000;

// Compare and replace both the record and its due entry. Changes received while a
// dispatcher holds a lease must survive its later acknowledgement.
const UPDATE = `
local current = redis.call('GET', KEYS[1]) or ''
if current ~= ARGV[1] then return 0 end
if ARGV[3] ~= '' and not redis.call('ZSCORE', KEYS[2], KEYS[1])
  and redis.call('ZCARD', KEYS[2]) >= tonumber(ARGV[4]) then return -1 end
redis.call('SET', KEYS[1], ARGV[2], 'PX', ARGV[5])
if ARGV[3] == '' then
  redis.call('ZREM', KEYS[2], KEYS[1])
else
  redis.call('ZADD', KEYS[2], ARGV[3], KEYS[1])
end
return 1
`;

@SingletonProto({ accessLevel: AccessLevel.PUBLIC })
export class SyncRecheckQueue {
  @Inject()
  private readonly redis: Redis;
  @Inject()
  private readonly config: Config;

  key(registryId: string, fullname: string) {
    const digest = createHash('sha256')
      .update(JSON.stringify([registryId, fullname]))
      .digest('hex');
    return `${PREFIX}${digest}`;
  }

  async get(key: string): Promise<SyncRecheckState | null> {
    const value = await this.redis.get(key);
    return value ? JSON.parse(value) : null;
  }

  private async update(
    key: string,
    change: (state: SyncRecheckState | null) => SyncRecheckState | undefined,
  ): Promise<SyncRecheckState | null> {
    const config = this.config.cnpmcore.syncRecheck;
    for (let attempt = 0; attempt < 10; attempt++) {
      const before = (await this.redis.get(key)) || '';
      const after = change(before ? JSON.parse(before) : null);
      if (!after) return null;
      const result = await this.redis.eval(
        UPDATE,
        2,
        key,
        DUE,
        before,
        JSON.stringify(after),
        after.pending ? after.nextCheckAt : '',
        config.maxPendingPackages,
        Math.max(2 * HOUR, (config.delays.at(-1) || 0) + HOUR),
      );
      if (result === 1) return after;
      if (result === -1) return null;
    }
    throw new Error('Sync recheck record changed too often');
  }

  async record(input: { fullname: string; registryId: string; seq: string; taskId: string; version?: string }) {
    const now = Date.now();
    const firstDelay = this.config.cnpmcore.syncRecheck.delays[0];
    return await this.update(this.key(input.registryId, input.fullname), (state) => {
      if (state?.seq === input.seq && (input.version ? state.expectedVersions[input.version] : state.unknownTarget))
        return undefined;
      const previous = state;
      if (!state?.pending) {
        state = {
          fullname: input.fullname,
          registryId: input.registryId,
          seq: input.seq,
          generation: previous?.generation || 0,
          firstSeenAt: now,
          nextCheckAt: now + firstDelay,
          pending: true,
          step: 0,
          attempts: previous?.attempts || [],
          expectedVersions: {},
          unknownTarget: false,
          lastTaskId: input.taskId,
        };
      }
      state.seq = input.seq;
      state.generation++;
      state.lastTaskId = input.taskId;
      if (input.version && Object.keys(state.expectedVersions).length < 64) {
        state.expectedVersions[input.version] = true;
      } else {
        state.unknownTarget = true;
      }
      return state;
    });
  }

  async claim() {
    const config = this.config.cnpmcore.syncRecheck;
    const now = Date.now();
    // A shared gate bounds dispatcher work across processes and hosts.
    if (!(await this.redis.set(`${PREFIX}dispatch`, '1', 'PX', config.dispatchInterval, 'NX'))) return null;
    const [key] = await this.redis.zrangebyscore(DUE, '-inf', now, 'LIMIT', 0, 1);
    if (!key) return null;
    const state = await this.update(key, (current) => {
      if (!current?.pending || current.nextCheckAt > now) return undefined;
      current.lease = randomBytes(16).toString('hex');
      current.nextCheckAt = now + LEASE;
      return current;
    });
    if (!state && !(await this.redis.exists(key))) await this.redis.zrem(DUE, key);
    return state ? { key, state } : null;
  }

  async defer(key: string, lease: string, delay = 30_000) {
    return await this.update(key, (state) => {
      if (!state || state.lease !== lease) return undefined;
      state.nextCheckAt = Date.now() + delay;
      delete state.lease;
      return state;
    });
  }

  async finish(key: string, claimed: SyncRecheckState) {
    return await this.update(key, (state) => {
      if (!state || state.lease !== claimed.lease) return undefined;
      state.pending = state.generation !== claimed.generation;
      state.nextCheckAt = Date.now() + this.config.cnpmcore.syncRecheck.delays[0];
      delete state.lease;
      return state;
    });
  }

  async reserve(key: string, lease: string) {
    const now = Date.now();
    return await this.update(key, (state) => {
      if (!state || state.lease !== lease) return undefined;
      if (state.dispatchTaskId) return state;
      state.attempts = state.attempts.filter((time) => time > now - HOUR);
      if (state.attempts.length >= this.config.cnpmcore.syncRecheck.maxAttemptsPerHour) {
        state.nextCheckAt = state.attempts[0] + HOUR;
        delete state.lease;
        return state;
      }
      // Reserve before enqueueing; a restart reuses this task ID and budget slot.
      state.attempts.push(now);
      state.dispatchTaskId = randomBytes(12).toString('hex');
      state.dispatchGeneration = state.generation;
      return state;
    });
  }

  async dispatched(key: string, reserved: SyncRecheckState, taskId: string) {
    const delays = this.config.cnpmcore.syncRecheck.delays;
    return await this.update(key, (state) => {
      if (!state || state.lease !== reserved.lease) return undefined;
      state.lastTaskId = taskId;
      // Keep a slow or recovered enqueue in the budget until an hour after acknowledgement.
      state.attempts[state.attempts.length - 1] = Date.now();
      state.step++;
      if (state.step >= delays.length && state.generation !== reserved.dispatchGeneration) {
        state.step = 0;
        state.firstSeenAt = Date.now();
      }
      state.pending = state.step < delays.length;
      state.nextCheckAt = Math.max(Date.now() + 1000, state.firstSeenAt + (delays[state.step] || 0));
      delete state.lease;
      delete state.dispatchTaskId;
      delete state.dispatchGeneration;
      return state;
    });
  }
}
