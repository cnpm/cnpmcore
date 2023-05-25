import { AbstractBinary, FetchResult, BinaryItem, BinaryAdapter } from './AbstractBinary';
import { Inject, SingletonProto } from '@eggjs/tegg';
import { BinaryType } from '../../enum/Binary';
import { EggAppConfig } from 'egg';

@SingletonProto()
@BinaryAdapter(BinaryType.Api)
export class ApiBinary extends AbstractBinary {
  @Inject()
  private readonly config: EggAppConfig;

  async initFetch() {
    // do nothing
    return;
  }

  async fetch(dir: string, binaryName: string): Promise<FetchResult | undefined> {
    const apiUrl = this.config.cnpmcore.syncBinaryFromAPISource || `${this.config.cnpmcore.sourceRegistry}/-/binary`;
    const url = `${apiUrl}/${binaryName}${dir}`;
    const data = await this.requestJSON(url);
    if (!Array.isArray(data)) {
      this.logger.warn('[ApiBinary.fetch:response-data-not-array] data: %j', data);
      return;
    }
    const items: BinaryItem[] = [];
    for (const item of data) {
      items.push({
        name: item.name,
        isDir: item.type === 'dir',
        url: item.url,
        size: item.size || '-',
        date: item.date,
      });
    }
    return { items };
  }
}
