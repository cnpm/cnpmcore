import { ContextProto } from '@eggjs/tegg';
import { RegistryType } from 'app/common/enum/Registry';
import { Registry } from 'app/core/entity/Registry';
import { E500 } from 'egg-errors';
import { AbstractChangeStream, ChangesStreamChange, RegistryChangesStream } from './AbstractChangesStream';
import { Transform, Readable } from 'node:stream';

@ContextProto()
@RegistryChangesStream(RegistryType.Npm)
export class NpmChangesStream extends AbstractChangeStream {

  private legacy = '';

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

  // 网络问题可能会导致获取到的数据不完整
  // 最后数据可能会发生截断，需要按行读取，例如:
  // "seq": 1, "id": "test1",
  // "seq"
  // :2,
  // "id": "test2",
  // 先保存在 legacy 中，参与下次解析
  parseChangeChunk(text: string): ChangesStreamChange[] {
    const lines = text.split('\n');
    const changes: ChangesStreamChange[] = [];

    for (const line of lines) {
      const content = this.legacy + line;
      const match = /"seq":(\d+),"id":"([^"]+)"/g.exec(content);
      const seq = match?.[1];
      const fullname = match?.[2];
      if (seq && fullname) {
        changes.push({ seq, fullname });
        this.legacy = '';
      } else {
        this.legacy += line;
        this.logger.warn('[NpmChangesStream.fetchChanges] invalid line chunk: %s', line);
      }
    }

    return changes;
  }

  async fetchChanges(registry: Registry, since: string): Promise<Readable> {
    const self = this;
    const { parseChangeChunk } = this;
    const db = this.getChangesStreamUrl(registry, since);
    const { res } = await this.httpclient.request(db, {
      streaming: true,
      timeout: 10000,
    });

    const transform = new Transform({
      readableObjectMode: true,
      transform(chunk, _, callback) {
        const text = chunk.toString();
        const changes = parseChangeChunk.call(self, text?.trim());
        changes.forEach(change => this.push(change));
        callback();
      },
    });

    return res.pipe(transform);
  }

}
