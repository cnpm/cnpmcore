import { ContextProto } from '@eggjs/tegg';
import { RegistryType } from 'app/common/enum/Registry';
import { Registry } from 'app/core/entity/Registry';
import { E500 } from 'egg-errors';
import { AbstractChangeStream, FetchChangesResult, RegistryChangesStream } from './AbstractChangesStream';

const MAX_LIMIT = 10000;

@ContextProto()
@RegistryChangesStream(RegistryType.Cnpmjsorg)
export class CnpmjsorgChangesStream extends AbstractChangeStream {

  // cnpmjsorg 未实现 update_seq 字段
  // 返回静态的 since
  // 后续可以将 since 改为 registry.gmt_modified 来初始化增量同步
  async getInitialSince(registry: Registry): Promise<string> {
    const since = '1';
    this.logger.warn(`[ChangesStreamService.executeTask:firstSeq] since: 1, skip query ${registry.changeStream}`);
    return since;
  }

  private async tryFetch(registry: Registry, since: string, limit = 1000) {
    if (limit > MAX_LIMIT) {
      throw new E500(`limit too large, current since: ${since}, limit: ${limit}`);
    }
    const db = `${registry.changeStream}?since=${since}&limit=${limit}`;
    // json mode
    const res = await this.httpclient.request(db, {
      followRedirect: true,
      timeout: 30000,
      dataType: 'json',
      gzip: true,
    });
    const { results = [] } = res.data;
    if (results?.length > 1) {
      const [ first ] = results;
      const last = results[results.length - 1];
      if (first.gmt_modified === last.gmt_modified) {
        return await this.tryFetch(registry, last.seq, limit + 1000);
      }
    }

    return res;
  }

  async fetchChanges(registry: Registry, since: string): Promise<FetchChangesResult> {
    let lastSince = since;
    let taskCount = 0;
    const changes: FetchChangesResult['changes'] = [];

    // ref: https://github.com/cnpm/cnpmjs.org/pull/1734
    // 由于 cnpmjsorg 无法计算准确的 seq
    // since 是一个时间戳，需要确保一次返回的结果中首尾两个 gmtModified 不相等
    const { data } = await this.tryFetch(registry, since);

    if (data.results?.length > 0) {
      for (const change of data.results) {
        const seq = new Date(change.gmt_modified).getTime() + '';
        const fullname = change.id;
        if (seq && fullname && seq !== since) {
          taskCount++;
          changes.push({
            fullname,
            seq,
          });
          lastSince = seq;
        }
      }
    }

    return {
      lastSince,
      taskCount,
      changes,
    };
  }
}
