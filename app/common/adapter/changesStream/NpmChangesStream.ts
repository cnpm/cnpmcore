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
  // 先保存在 legacy 中，参与下次解析
  parseChangeChunk(text: string): ChangesStreamChange[] {
    const matches = (this.legacy + text).matchAll(/"seq":(\d+),"id":"([^"]+)"/gm);
    const changes: ChangesStreamChange[] = [];
    for (const match of matches) {
      const seq = match[1];
      const fullname = match[2];
      if (seq && fullname) {
        // 已经完成解析，清空 legacy
        changes.push({ seq, fullname });
      }
    }

    // 这次没有提取到数据，保存在 legacy 中
    if (changes.length === 0) {
      this.logger.warn('[NpmChangesStream.fetchChanges] invalid change chunk: %s', text);
      this.legacy += text;
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
