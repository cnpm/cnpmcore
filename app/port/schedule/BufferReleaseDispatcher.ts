import { Inject, Logger } from 'egg';
import { Schedule, ScheduleType, type IntervalParams } from 'egg/schedule';

import type { CacheAdapter } from '../../common/adapter/CacheAdapter.ts';
import type { QueueAdapter } from '../../common/typing.ts';
import type { PackageVersionBlockRepository } from '../../repository/PackageVersionBlockRepository.ts';

// dependency isolation release work queue: https://github.com/cnpm/cnpmcore/issues/1057
export const DEPENDENCY_ISOLATION_RELEASE_QUEUE = 'dependency_isolation_release';

// Dispatcher: lightweight single-instance scan of expired buffer records, grouped by
// package and pushed to the release queue. The heavy unblock work is done by
// BufferReleaseWorker (ScheduleType.ALL) so it is distributed across the cluster.
// The DB rows are the source of truth — a dropped queue message is re-enqueued on the
// next run, and the batch release is idempotent.
@Schedule<IntervalParams>(
  {
    type: ScheduleType.WORKER,
    scheduleData: {
      interval: 60_000,
    },
  },
  {
    immediate: process.env.NODE_ENV !== 'test',
  },
)
export class BufferReleaseDispatcher {
  @Inject()
  private readonly packageVersionBlockRepository: PackageVersionBlockRepository;

  @Inject()
  private readonly queueAdapter: QueueAdapter;

  @Inject()
  private readonly cacheAdapter: CacheAdapter;

  @Inject()
  private readonly logger: Logger;

  async subscribe() {
    // intentionally NOT gated on enableDependencyIsolation: the flag only gates *new* isolation
    // decisions at publish; existing buffer rows must still be drained/released even after the
    // flag is turned off (e.g. rollback), otherwise those versions stay blocked forever.
    // lock TTL is kept comfortably larger than the schedule interval (60s) so a slow scan/enqueue
    // run cannot let the lock expire mid-run and a parallel node re-scan + double-enqueue.
    await this.cacheAdapter.usingLock('BufferReleaseDispatcher', 120, async () => {
      // per-cycle batch cap: bounds backlog catch-up / re-enqueue churn (indexed query, cheap)
      const expiredBlocks = await this.packageVersionBlockRepository.findExpiredBufferedVersions(500);
      if (expiredBlocks.length === 0) return;
      // group by package so the worker rebuilds each package's manifest only once
      const versionsByPackageId = new Map<string, string[]>();
      for (const block of expiredBlocks) {
        const versions = versionsByPackageId.get(block.packageId) ?? [];
        versions.push(block.version);
        versionsByPackageId.set(block.packageId, versions);
      }
      for (const [packageId, versions] of versionsByPackageId) {
        await this.queueAdapter.push(DEPENDENCY_ISOLATION_RELEASE_QUEUE, { packageId, versions });
      }
      this.logger.info(
        '[BufferReleaseDispatcher:subscribe] enqueued %d packages, %d versions',
        versionsByPackageId.size,
        expiredBlocks.length
      );
    });
  }
}
