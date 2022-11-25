import { EggContextHttpClient, EggLogger } from 'egg';
import { AbstractBinary, FetchResult, BinaryItem } from './AbstractBinary';
import { BinaryTaskConfig } from '../../../../config/binaries';

export class ApiBinary extends AbstractBinary {
  private apiUrl: string;
  constructor(httpclient: EggContextHttpClient, logger: EggLogger, binaryConfig: BinaryTaskConfig, apiUrl: string, binaryName: string) {
    super(httpclient, logger, binaryConfig, binaryName);
    this.apiUrl = apiUrl;
  }

  async fetch(dir: string): Promise<FetchResult | undefined> {
    const url = `${this.apiUrl}/${this.binaryName}${dir}`;
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
