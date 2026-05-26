import { EggAppConfig, EggLogger } from 'egg';
import { IntervalParams, Schedule, ScheduleType } from '@eggjs/tegg/schedule';
import { Inject } from '@eggjs/tegg';
import { QueueAdapter } from '../../common/typing';
import { PackageManagerService } from '../../core/service/PackageManagerService';
import { DEPENDENCY_ISOLATION_RELEASE_QUEUE } from './BufferReleaseDispatcher';

interface ReleaseJob {
  packageId: string;
  versions: string[];
}

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
  private readonly config: EggAppConfig;

  @Inject()
  private readonly logger: EggLogger;

  async subscribe() {
    if (!this.config.cnpmcore.enableDependencyIsolation) return;
    let job = await this.queueAdapter.pop<ReleaseJob>(DEPENDENCY_ISOLATION_RELEASE_QUEUE);
    while (job) {
      try {
        await this.packageManagerService.releaseBufferedVersions(job.packageId, job.versions);
      } catch (err) {
        this.logger.error('[BufferReleaseWorker:subscribe] release packageId: %s failed: %s', job.packageId, err);
      }
      job = await this.queueAdapter.pop<ReleaseJob>(DEPENDENCY_ISOLATION_RELEASE_QUEUE);
    }
  }
}
