import os from 'os';
import { Task } from 'app/core/entity/Task';
import { AbstractRegistry, HandleResult } from './AbstractRegistry';
import { PackageSyncerService } from 'app/core/service/PackageSyncerService';

export class NpmRegistry extends AbstractRegistry {
  // fetch changes from cnpmjs.org based registry
  // since we hasn't support seqId, we need to detect limit
  async fetch(since: string) {
    since = since || '1';
    const { registry } = this;
    const { status, data } = await this.httpclient.request(
      `${registry.changeStream}?since=${since}`,
      {
        followRedirect: true,
        timeout: 10000,
        dataType: 'json',
        retry: 3,
      },
    );
    return { status, data, since };
  }

  async handleChanges(since: string, taskData: Task['data'], packageSyncerService: PackageSyncerService): Promise<HandleResult> {
    const db = `${this.registry.changeStream}?since=${since}&limit=2000`;
    let res = {};
    let lastSince = since;
    let syncCount = 0;
    let taskCount = 0;
    // json mode
    const { data } = await this.httpclient.request(db, {
      followRedirect: true,
      timeout: 30000,
      dataType: 'json',
      gzip: true,
    });
    if (data.results?.length > 0) {
      let count = 0;
      let lastPackage = '';
      for (const change of data.results) {
        const seq = new Date(change.gmt_modified).getTime() + '';
        const fullname = change.id;
        if (seq && fullname && seq !== since) {
          if (this.needSync(this.registry.scopes, fullname)) {
            syncCount++;
            await packageSyncerService.createTask(fullname, {
              authorIp: os.hostname(),
              authorId: 'ChangesStreamService',
              skipDependencies: true,
              registryHost: this.registry.host,
              registryName: this.registry.name,
              userPrefix: this.registry.userPrefix,
              tips: `Sync cause by changes_stream(${this.registry.changeStream}) update seq: ${seq}, change: ${JSON.stringify(change)}`,
            });
          }
          count++;
          lastSince = seq;
          lastPackage = fullname;
        }
      }
      if (count > 0) {
        res = {
          since: lastSince,
          last_package: lastPackage,
          last_package_created: new Date(),
          task_count: (taskData.task_count || 0) + count,
          sync_count: (taskData.sync_count || 0) + syncCount,
        };
      }
      taskCount = count;
    }
    return {
      lastSince,
      taskData: res,
      taskCount,
    };
  }
}
