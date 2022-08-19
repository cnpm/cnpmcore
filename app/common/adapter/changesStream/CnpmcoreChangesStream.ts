import { Readable } from 'node:stream';
import { ContextProto } from '@eggjs/tegg';
import { RegistryType } from '../../../common/enum/Registry';
import { Registry } from '../../../core/entity/Registry';
import { E500 } from 'egg-errors';
import { AbstractChangeStream, ChangesStreamChange, RegistryChangesStream } from './AbstractChangesStream';

@ContextProto()
@RegistryChangesStream(RegistryType.Cnpmcore)
export class CnpmcoreChangesStream extends AbstractChangeStream {

  async getInitialSince(registry: Registry): Promise<string> {
    const db = (new URL(registry.changeStream)).origin;
    const { status, data } = await this.httpclient.request(db, {
      followRedirect: true,
      timeout: 10000,
      dataType: 'json',
    });
    if (!data.update_seq) {
      throw new E500(`get getInitialSince failed: ${data.update_seq}`);
    }
    const since = String(data.update_seq - 10);
    this.logger.warn('[NpmChangesStream.getInitialSince:firstSeq] GET %s status: %s, data: %j, since: %s',
      registry.name, status, data, since);
    return since;
  }

  async fetchChanges(registry: Registry, since: string): Promise<Readable> {
    const changes: ChangesStreamChange[] = [];

    const db = this.getChangesStreamUrl(registry, since);
    // json mode
    const { data } = await this.httpclient.request(db, {
      followRedirect: true,
      timeout: 30000,
      dataType: 'json',
      gzip: true,
    });

    if (data.results?.length > 0) {
      for (const change of data.results) {
        const seq = String(change.seq);
        const fullname = change.id;
        // cnpmcore 默认返回 >= 需要做特殊判断
        if (seq && fullname && seq !== since) {
          changes.push({
            fullname,
            seq,
          });
        }
      }
    }

    return Readable.from(changes);
  }
}
