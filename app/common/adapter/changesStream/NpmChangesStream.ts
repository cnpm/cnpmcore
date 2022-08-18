import { ContextProto } from '@eggjs/tegg';
import { RegistryType } from 'app/common/enum/Registry';
import { Registry } from 'app/core/entity/Registry';
import { E500 } from 'egg-errors';
import { AbstractChangeStream, ChangesStreamChange, RegistryChangesStream } from './AbstractChangesStream';
import { Transform, Readable } from 'node:stream';

@ContextProto()
@RegistryChangesStream(RegistryType.Npm)
export class NpmChangesStream extends AbstractChangeStream {

  async getInitialSince(registry: Registry): Promise<string> {
    const db = (new URL(registry.changeStream)).origin;
    const { status, data } = await this.httpclient.request(db, {
      followRedirect: true,
      timeout: 10000,
      dataType: 'json',
    });
    const since = String(data.update_seq - 10);
    if (!data.update_seq) {
      throw new E500(`get getInitialSince failed: ${data.update_seq}`);
    }
    this.logger.warn('[NpmChangesStream.getInitialSince] GET %s status: %s, data: %j, since: %s',
      registry.name, registry.changeStream, status, data, since);
    return since;
  }

  async fetchChanges(registry: Registry, since: string): Promise<Readable> {

    const db = `${registry.changeStream}?since=${since}`;
    const { res } = await this.httpclient.request(db, {
      streaming: true,
      timeout: 10000,
    });

    const transform = new Transform({
      readableObjectMode: true,
      transform(chunk, _, callback) {
        const text = chunk.toString();
        const matchs = text.matchAll(/"seq":(\d+),"id":"([^"]+)"/gm);
        for (const match of matchs) {
          const seq = match[1];
          const fullname = match[2];
          if (seq && fullname) {
            this.push({ fullname, seq } as ChangesStreamChange);
          }
        }
        callback();
      },
    });

    return res.pipe(transform);
  }

}
