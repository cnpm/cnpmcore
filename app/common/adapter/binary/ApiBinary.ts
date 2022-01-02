import { EggContextHttpClient, EggLogger } from 'egg';
import { AbstractBinary, FetchResult, BinaryItem } from './AbstractBinary';

export class ApiBinary extends AbstractBinary {
  private sourceRegistry: string;
  private binaryName: string;
  constructor(httpclient: EggContextHttpClient, logger: EggLogger, binaryName: string, sourceRegistry: string) {
    super(httpclient, logger);
    this.sourceRegistry = sourceRegistry;
    this.binaryName = binaryName;
  }

  async fetch(dir: string): Promise<FetchResult | undefined> {
    const url = `${this.sourceRegistry}/-/binary/${this.binaryName}${dir}`;
    const { status, data, headers } = await this.httpclient.request(url, {
      timeout: 20000,
      dataType: 'json',
      followRedirect: true,
    });
    if (status !== 200) {
      this.logger.warn('[ApiBinary.fetch:non-200-status] status: %s, headers: %j', status, headers);
      return;
    }
    const items: BinaryItem[] = [];
    for (const item of data.items) {
      items.push({
        name: item.name,
        isDir: item.isDir,
        url: item.url,
        size: item.size,
        date: item.date,
      });
    }
    return { items };
  }
}
