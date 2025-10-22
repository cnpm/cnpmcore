import { Inject, SingletonProto } from '@eggjs/tegg';
import type { EggAppConfig } from 'egg';
import { BinaryType } from '../../enum/Binary.ts';
import {
  AbstractBinary,
  BinaryAdapter,
  type BinaryItem,
  type FetchResult,
} from './AbstractBinary.ts';

@SingletonProto()
@BinaryAdapter(BinaryType.Api)
export class ApiBinary extends AbstractBinary {
  @Inject()
  private readonly config: EggAppConfig;

  async initFetch() {
    // do nothing
    return;
  }

  async fetch(
    dir: string,
    binaryName: string,
    lastData?: Record<string, unknown>
  ): Promise<FetchResult | undefined> {
    const apiUrl =
      this.config.cnpmcore.syncBinaryFromAPISource ||
      `${this.config.cnpmcore.sourceRegistry}/-/binary`;
    let url = `${apiUrl}/${binaryName}${dir}`;
    if (lastData && lastData.lastSyncTime) {
      url += `?since=${lastData.lastSyncTime}&limit=100`;
    }

    const data = await this.requestJSON(url);
    if (!Array.isArray(data)) {
      this.logger.warn(
        '[ApiBinary.fetch:response-data-not-array] data: %j',
        data
      );
      return;
    }
    const items: BinaryItem[] = [];
    for (const item of data) {
      items.push({
        name: item.name,
        isDir: item.type === 'dir',
        url: item.url,
        // oxlint-disable-next-line unicorn/explicit-length-check
        size: item.size || '-',
        date: item.date,
      });
    }
    return { items };
  }
}
