import { EggAppConfig, EggLogger } from 'egg';
import { IntervalParams, Schedule, ScheduleType } from '@eggjs/tegg/schedule';
import { Inject } from '@eggjs/tegg';
import { QueueAdapter } from '../../common/typing';
import { CacheAdapter } from '../../common/adapter/CacheAdapter';
import { PackageVersionBlockRepository } from '../../repository/PackageVersionBlockRepository';

// dependency isolation release work queue: https://github.com/cnpm/cnpmcore/issues/1057
export const DEPENDENCY_ISOLATION_RELEASE_QUEUE = 'dependency_isolation_release';

// Dispatcher: lightweight single-instance scan of expired buffer records, grouped by
// package and pushed to the release queue. The heavy unblock work is done by
// BufferReleaseWorker (ScheduleType.ALL) so it is distributed across the cluster.
// The DB rows are the source of truth — a dropped queue message is re-enqueued on the
// next run, and the batch release is idempotent.
@Schedule<IntervalParams>({
  type: ScheduleType.WORKER,
  scheduleData: {
    interval: 60000,
  },
}, {
  immediate: process.env.NODE_ENV !== 'test',
})
export class BufferReleaseDispatcher {
  @Inject()
  private readonly packageVersionBlockRepository: PackageVersionBlockRepository;

  @Inject()
  private readonly queueAdapter: QueueAdapter;

  @Inject()
  private readonly cacheAdapter: CacheAdapter;

  @Inject()
  private readonly config: EggAppConfig;

  @Inject()
  private readonly logger: EggLogger;

  async subscribe() {
    if (!this.config.cnpmcore.enableDependencyIsolation) return;
    // lock TTL is kept comfortably larger than the schedule interval (60s) so a slow scan/enqueue
    // run cannot let the lock expire mid-run and a parallel node re-scan + double-enqueue.
    await this.cacheAdapter.usingLock('BufferReleaseDispatcher', 120, async () => {
      const expiredBlocks = await this.packageVersionBlockRepository.findExpiredBufferedVersions(1000);
      if (expiredBlocks.length === 0) return;
      // group by package so the worker rebuilds each package's manifest only once
      const versionsByPackageId = new Map<string, string[]>();
      for (const block of expiredBlocks) {
        const versions = versionsByPackageId.get(block.packageId) ?? [];
        versions.push(block.version);
        versionsByPackageId.set(block.packageId, versions);
      }
      for (const [ packageId, versions ] of versionsByPackageId) {
        await this.queueAdapter.push(DEPENDENCY_ISOLATION_RELEASE_QUEUE, { packageId, versions });
      }
      this.logger.info('[BufferReleaseDispatcher:subscribe] enqueued %d packages, %d versions',
        versionsByPackageId.size, expiredBlocks.length);
    });
  }
}
