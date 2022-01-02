import { EggContextHttpClient, EggLogger } from 'egg';

export type BinaryItem = {
  name: string;
  isDir: boolean;
  url: string;
  size: string;
  date: string;
};

export type FetchResult = {
  items: BinaryItem[];
  nextParams: any;
};

export abstract class AbstractBinary {
  protected httpclient: EggContextHttpClient;
  protected logger: EggLogger;

  constructor(httpclient: EggContextHttpClient, logger: EggLogger) {
    this.httpclient = httpclient;
    this.logger = logger;
  }

  abstract fetch(dir: string, params?: any): Promise<FetchResult | undefined>;
}
