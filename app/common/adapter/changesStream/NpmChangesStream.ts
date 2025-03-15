import { SingletonProto } from '@eggjs/tegg';
import { E500 } from 'egg-errors';

import { RegistryType } from '../../../common/enum/Registry.js';
import type { Registry } from '../../../core/entity/Registry.js';
import {
  AbstractChangeStream,
  RegistryChangesStream,
  type ChangesStreamChange,
} from './AbstractChangesStream.js';

@SingletonProto()
@RegistryChangesStream(RegistryType.Npm)
export class NpmChangesStream extends AbstractChangeStream {
  async getInitialSince(registry: Registry): Promise<string> {
    const db = new URL(registry.changeStream).origin;
    const { status, data } = await this.httpclient.request(db, {
      followRedirect: true,
      timeout: 10000,
      dataType: 'json',
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

  async *fetchChanges(registry: Registry, since: string) {
    const db = this.getChangesStreamUrl(registry, since);
    const { res } = await this.httpclient.request(db, {
      streaming: true,
      timeout: 60000,
    });

    let buf = '';
    for await (const chunk of res) {
      const text = chunk.toString();
      const lines = text.split('\n');

      for (const line of lines) {
        const content = buf + line;
        const match = /"seq":(\d+),"id":"([^"]+)"/g.exec(content);
        const seq = match?.[1];
        const fullname = match?.[2];
        if (seq && fullname) {
          buf = '';
          const change: ChangesStreamChange = { fullname, seq };
          yield change;
        } else {
          buf += line;
        }
      }
    }
  }
}
