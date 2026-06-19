import { Inject, Logger } from 'egg';
import { Schedule, ScheduleType, type IntervalParams } from 'egg/schedule';

import type { QueueAdapter } from '../../common/typing.ts';
import type { PackageManagerService } from '../../core/service/PackageManagerService.ts';
import { DEPENDENCY_ISOLATION_RELEASE_QUEUE } from './BufferReleaseDispatcher.ts';

interface ReleaseJob {
  packageId: string;
  versions: string[];
}

// re-entrancy guard: each release job does a full manifest rebuild + storage write, which can
// exceed the 1s interval; without this the scheduler would run overlapping drains on the same
// node (same pattern as SyncPackageWorker / TriggerHookWorker).
let executing = false;

// Worker: runs on every node (ScheduleType.ALL) and pops release jobs enqueued by
// BufferReleaseDispatcher, then performs the heavy per-package batch unblock. The queue
// pop is atomic, so each job is handled by a single node and the unblock load (manifest
// rebuild + storage write) is distributed across the cluster — same model as SyncPackageWorker.
@Schedule<IntervalParams>({
  type: ScheduleType.ALL,
  scheduleData: {
    interval: 1000,
  },
})
export class BufferReleaseWorker {
  @Inject()
  private readonly queueAdapter: QueueAdapter;

  @Inject()
  private readonly packageManagerService: PackageManagerService;

  @Inject()
  private readonly logger: Logger;

  async subscribe() {
    // intentionally NOT gated on enableDependencyIsolation: must keep draining/releasing buffer
    // rows enqueued before the flag was turned off. when no rows are buffered the queue is empty,
    // so this is a cheap no-op pop.
    // skip this tick if a previous drain on this node is still running
    if (executing) return;
    executing = true;
    try {
      let job = await this.queueAdapter.pop<ReleaseJob>(DEPENDENCY_ISOLATION_RELEASE_QUEUE);
      while (job) {
        try {
          await this.packageManagerService.releaseBufferedVersions(job.packageId, job.versions);
        } catch (err) {
          this.logger.error('[BufferReleaseWorker:subscribe] release packageId: %s failed: %s', job.packageId, err);
        }
        job = await this.queueAdapter.pop<ReleaseJob>(DEPENDENCY_ISOLATION_RELEASE_QUEUE);
      }
    } finally {
      executing = false;
    }
  }
}
