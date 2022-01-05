import { EggContextHttpClient, EggLogger } from 'egg';

export type BinaryItem = {
  name: string;
  isDir: boolean;
  url: string;
  size: string | number;
  date: string;
};

export type FetchResult = {
  items: BinaryItem[];
  nextParams?: any;
};

export abstract class AbstractBinary {
  protected httpclient: EggContextHttpClient;
  protected logger: EggLogger;

  constructor(httpclient: EggContextHttpClient, logger: EggLogger) {
    this.httpclient = httpclient;
    this.logger = logger;
  }

  abstract fetch(dir: string, params?: any): Promise<FetchResult | undefined>;

  protected async requestXml(url: string) {
    const { status, data, headers } = await this.httpclient.request(url, {
      timeout: 20000,
      followRedirect: true,
      gzip: true,
    });
    const xml = data.toString() as string;
    if (status !== 200) {
      this.logger.warn('[AbstractBinary.requestXml:non-200-status] url: %s, status: %s, headers: %j, xml: %j', url, status, headers, xml);
      return '';
    }
    return xml;
  }

  protected async requestJSON(url: string) {
    const { status, data, headers } = await this.httpclient.request(url, {
      timeout: 20000,
      dataType: 'json',
      followRedirect: true,
      gzip: true,
    });
    if (status !== 200) {
      this.logger.warn('[AbstractBinary.requestJSON:non-200-status] url: %s, status: %s, headers: %j', url, status, headers);
      return data;
    }
    return data;
  }
}
