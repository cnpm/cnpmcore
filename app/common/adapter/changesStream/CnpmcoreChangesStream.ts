import { SingletonProto } from '@eggjs/tegg';
import { E500 } from 'egg-errors';
import { RegistryType } from '../../../common/enum/Registry.ts';
import type { Registry } from '../../../core/entity/Registry.ts';
import {
  AbstractChangeStream,
  RegistryChangesStream,
} from './AbstractChangesStream.ts';

@SingletonProto()
@RegistryChangesStream(RegistryType.Cnpmcore)
export class CnpmcoreChangesStream extends AbstractChangeStream {
  async getInitialSince(registry: Registry): Promise<string> {
    const db = new URL(registry.changeStream).origin;
    const { status, data } = await this.httpclient.request(db, {
      followRedirect: true,
      timeout: 10_000,
      dataType: 'json',
    });
    if (!data.update_seq) {
      throw new E500(`get getInitialSince failed: ${data.update_seq}`);
    }
    const since = String(data.update_seq - 10);
    this.logger.warn(
      '[NpmChangesStream.getInitialSince:firstSeq] GET %s status: %s, data: %j, since: %s',
      registry.name,
      status,
      data,
      since
    );
    return since;
  }

  async *fetchChanges(registry: Registry, since: string) {
    const db = this.getChangesStreamUrl(registry, since);
    // json mode
    const { data } = await this.httpclient.request(db, {
      followRedirect: true,
      timeout: 30_000,
      dataType: 'json',
      gzip: true,
    });

    if (data.results?.length > 0) {
      for (const change of data.results) {
        const seq = String(change.seq);
        const fullname = change.id;
        // cnpmcore 默认返回 >= 需要做特殊判断
        if (seq && fullname && seq !== since) {
          const change = {
            fullname,
            seq,
          };
          yield change;
        }
      }
    }
  }
}
