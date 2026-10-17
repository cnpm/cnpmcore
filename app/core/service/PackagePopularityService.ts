import { randomUUID } from 'node:crypto';

import { AccessLevel, HttpClient, Inject, SingletonProto } from 'egg';
import type { Redis } from 'ioredis';

import { AbstractService } from '../../common/AbstractService.ts';
import type { PackagePopularity } from '../../common/SyncRecheck.ts';
import type { PackageVersionDownloadRepository } from '../../repository/PackageVersionDownloadRepository.ts';

const SNAPSHOT = 'CNPMCORE_SYNC_RECHECK:popular';
const UPDATED = `${SNAPSHOT}:updated`;
const LOCK = `${SNAPSHOT}:lock`;
const DAY = 24 * 60 * 60_000;

@SingletonProto({ accessLevel: AccessLevel.PUBLIC })
export class PackagePopularityService extends AbstractService {
  @Inject()
  private readonly redis: Redis;
  @Inject()
  private readonly httpClient: HttpClient;
  @Inject()
  private readonly packageVersionDownloadRepository: PackageVersionDownloadRepository;

  validateConfig() {
    const config = this.config.cnpmcore.syncRecheck;
    for (const value of [
      config.minWeeklyDownloads,
      config.maxPackages,
      config.refreshInterval,
      config.maxAttemptsPerHour,
      config.dispatchInterval,
      ...config.delays,
    ]) {
      if (!Number.isSafeInteger(value) || value <= 0) throw new Error('syncRecheck limits must be positive integers');
    }
    if (!config.delays.length || config.delays.some((delay, i) => i > 0 && delay <= config.delays[i - 1])) {
      throw new Error('syncRecheck.delays must be nonempty and strictly increasing');
    }
  }

  async includes(fullname: string) {
    if (!this.config.cnpmcore.syncRecheck.enabled) return false;
    return (await this.redis.sismember(SNAPSHOT, fullname)) === 1;
  }

  async refresh() {
    const config = this.config.cnpmcore.syncRecheck;
    if (!config.enabled) return;
    this.validateConfig();
    const now = Date.now();
    if (
      now - Number((await this.redis.get(UPDATED)) || 0) < config.refreshInterval &&
      (await this.redis.exists(SNAPSHOT))
    )
      return;
    const token = randomUUID();
    if (!(await this.redis.set(LOCK, token, 'PX', 60_000, 'NX'))) return;
    try {
      let packages: PackagePopularity[];
      if (config.popularityUrl) {
        const { status, data } = await this.httpClient.request<{
          updatedAt: string;
          packages: PackagePopularity[];
        }>(config.popularityUrl, { dataType: 'json', timeout: 30_000 });
        const updatedAt = Date.parse(data?.updatedAt);
        if (
          status !== 200 ||
          !Number.isFinite(updatedAt) ||
          updatedAt > now ||
          now - updatedAt > DAY ||
          !Array.isArray(data.packages)
        ) {
          throw new Error('Invalid or stale sync recheck popularity snapshot');
        }
        packages = data.packages;
      } else {
        packages = await this.packageVersionDownloadRepository.listPopularPackages(
          config.minWeeklyDownloads,
          config.maxPackages,
        );
      }
      const counts = new Map<string, number>();
      for (const item of packages) {
        if (
          !item ||
          typeof item.name !== 'string' ||
          !item.name ||
          item.name.length > 214 ||
          !Number.isSafeInteger(item.downloads) ||
          item.downloads < config.minWeeklyDownloads
        )
          continue;
        counts.set(item.name, Math.max(item.downloads, counts.get(item.name) || 0));
      }
      const names = [...new Set(config.include)].slice(0, config.maxPackages);
      for (const [name] of [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))) {
        if (names.length >= config.maxPackages) break;
        if (!names.includes(name)) names.push(name);
      }
      // Replace the whole set atomically; readers never observe an incomplete refresh.
      const temporary = `${SNAPSHOT}:${token}`;
      const batch = this.redis.multi();
      batch.sadd(temporary, '', ...names); // Sentinel also represents an empty selection.
      batch.pexpire(temporary, Math.max(DAY, config.refreshInterval * 2));
      const result = await batch.exec();
      const error = result?.find(([err]) => err)?.[0];
      if (error) throw error;
      const published = await this.redis.eval(
        `
        if redis.call('GET', KEYS[1]) ~= ARGV[1] then
          redis.call('DEL', KEYS[2])
          return 0
        end
        redis.call('RENAME', KEYS[2], KEYS[3])
        redis.call('SET', KEYS[4], ARGV[2])
        return 1
      `,
        4,
        LOCK,
        temporary,
        SNAPSHOT,
        UPDATED,
        token,
        now,
      );
      if (!published) return;
      this.logger.info('[PackagePopularityService.refresh] protected packages: %d', names.length);
    } finally {
      await this.redis.eval(
        "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0",
        1,
        LOCK,
        token,
      );
    }
  }
}
