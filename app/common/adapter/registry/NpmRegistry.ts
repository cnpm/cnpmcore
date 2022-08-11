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
    let lastSince = since;
    let syncCount = 0;
    let taskCount = 0;
    let taskResult = {};
    const { res } = await this.httpclient.request(db, {
      streaming: true,
      timeout: 10000,
    });
    for await (const chunk of res) {
      const text: string = chunk.toString();
      // {"seq":7138879,"id":"@danydodson/prettier-config","changes":[{"rev":"5-a56057032714af25400d93517773a82a"}]}
      // console.log('😄%j😄', text);
      // 😄"{\"seq\":7138738,\"id\":\"wargerm\",\"changes\":[{\"rev\":\"59-f0a0d326db4c62ed480987a04ba3bf8f\"}]}"😄
      // 😄",\n{\"seq\":7138739,\"id\":\"@laffery/webpack-starter-kit\",\"changes\":[{\"rev\":\"4-84a8dc470a07872f4cdf85cf8ef892a1\"}]},\n{\"seq\":7138741,\"id\":\"venom-bot\",\"changes\":[{\"rev\":\"103-908654b1ad4b0e0fd40b468d75730674\"}]}"😄
      // 😄",\n{\"seq\":7138743,\"id\":\"react-native-template-pytorch-live\",\"changes\":[{\"rev\":\"40-871c686b200312303ba7c4f7f93e0362\"}]}"😄
      // 😄",\n{\"seq\":7138745,\"id\":\"ccxt\",\"changes\":[{\"rev\":\"10205-25367c525a0a3bd61be3a72223ce212c\"}]}"😄
      const matchs = text.matchAll(/"seq":(\d+),"id":"([^"]+)"/gm);
      let count = 0;
      let lastPackage = '';
      for (const match of matchs) {
        const seq = match[1];
        const fullname = match[2];
        if (seq && this.needSync(this.registry.scopes, fullname)) {
          await packageSyncerService.createTask(fullname, {
            authorIp: os.hostname(),
            authorId: 'ChangesStreamService',
            skipDependencies: true,
            tips: `Sync cause by changes_stream(${this.registry.changeStream}) update seq: ${seq}`,
          });
          count++;
          lastSince = seq;
          lastPackage = fullname;
        }
      }
      if (count > 0) {
        taskResult = {
          since: lastSince,
          last_package: lastPackage,
          last_package_created: new Date(),
          task_count: (taskData.task_count || 0) + count,
          sync_count: (taskData.sync_count || 0) + syncCount,
        };
      }
    }
    return {
      lastSince,
      taskData: taskResult,
      taskCount,
      syncCount,
    };
  }
}
