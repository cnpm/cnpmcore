import { SingletonProto } from 'egg';
import { E500 } from 'egg/errors';

import { RegistryType } from '../../../common/enum/Registry.ts';
import type { Registry } from '../../../core/entity/Registry.ts';
import {
  AbstractChangeStream,
  RegistryChangesStream,
  type ChangesStreamChange,
} from './AbstractChangesStream.ts';

@SingletonProto()
@RegistryChangesStream(RegistryType.Npm)
export class NpmChangesStream extends AbstractChangeStream {
  async getInitialSince(registry: Registry): Promise<string> {
    const db = new URL(registry.changeStream).origin;
    const { status, data } = await this.httpClient.request(db, {
      followRedirect: true,
      timeout: 10_000,
      dataType: 'json',
      headers: {
        'npm-replication-opt-in': 'true',
      },
    });
    const since = String(data.update_seq - 10);
    if (!data.update_seq) {
      throw new E500(`get getInitialSince failed: ${data.update_seq}`);
    }
    this.logger.warn(
      '[NpmChangesStream.getInitialSince] GET %s status: %s, data: %j, since: %s',
      registry.name,
      registry.changeStream,
      status,
      data,
      since
    );
    return since;
  }

  async *fetchChanges(
    registry: Registry,
    since: string
  ): AsyncGenerator<ChangesStreamChange> {
    // https://github.com/orgs/community/discussions/152515
    const db = this.getChangesStreamUrl(registry, since);
    const { data, headers } = await this.httpClient.request(db, {
      timeout: 60_000,
      headers: {
        'npm-replication-opt-in': 'true',
      },
      dataType: 'json',
      gzip: true,
    });
    const count = data.results?.length;
    const last_seq = data.last_seq;
    this.logger.info(
      '[NpmChangesStream.fetchChanges] %s, count: %s, last_seq: %s, headers: %j',
      db,
      count,
      last_seq,
      headers
    );

    if (data.results?.length > 0) {
      for (const change of data.results) {
        // {
        //   seq: 2495018,
        //   id: 'ng-create-all-project',
        //   changes: [ { rev: '3-be3a014aab8e379ba28a28adb8e10142' }, [length]: 1 ],
        //   deleted: true
        // },
        const seq = String(change.seq);
        const fullname = change.id;
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
