import { EggContextHttpClient, EggLogger } from 'egg';
import { AbstractBinary, FetchResult, BinaryItem } from './AbstractBinary';

export class ApiBinary extends AbstractBinary {
  private apiUrl: string;
  private binaryName: string;
  constructor(httpclient: EggContextHttpClient, logger: EggLogger, binaryName: string, apiUrl: string) {
    super(httpclient, logger);
    this.apiUrl = apiUrl;
    this.binaryName = binaryName;
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
