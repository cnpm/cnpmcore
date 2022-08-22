import { ContextProto } from '@eggjs/tegg';
import { Readable, pipeline } from 'node:stream';
import { E500 } from 'egg-errors';
import { RegistryType } from '../../../common/enum/Registry';
import { Registry } from '../../../core/entity/Registry';
import { AbstractChangeStream, RegistryChangesStream } from './AbstractChangesStream';
import ChangesStreamTransform from '../../../core/util/ChangesStreamTransform';

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
    const db = this.getChangesStreamUrl(registry, since);
    const { res } = await this.httpclient.request(db, {
      streaming: true,
      timeout: 10000,
    });

    const transform = new ChangesStreamTransform();
    return pipeline(res, transform, error => {
      this.logger.error('[NpmChangesStream.fetchChanges] pipeline error: %s', error);
    });
  }

}
