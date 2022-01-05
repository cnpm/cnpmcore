import path from 'path';
import { EggContextHttpClient, EggLogger } from 'egg';
import { AbstractBinary, FetchResult, BinaryItem } from './AbstractBinary';

export class BucketBinary extends AbstractBinary {
  protected distUrl: string;

  constructor(httpclient: EggContextHttpClient, logger: EggLogger, distUrl: string) {
    super(httpclient, logger);
    this.distUrl = distUrl;
  }

  async fetch(dir: string): Promise<FetchResult | undefined> {
    // /foo/ => foo/
    const subDir = dir.substring(1);
    const url = `${this.distUrl}?delimiter=/&prefix=${encodeURIComponent(subDir)}`;
    const xml = await this.requestXml(url);
    return { items: this.parseItems(xml), nextParams: null };
  }

  protected async requestXml(url: string) {
    const { status, data, headers } = await this.httpclient.request(url, {
      timeout: 20000,
    });
    const xml = data.toString() as string;
    if (status !== 200) {
      this.logger.warn('[NodeBinary.fetch:non-200-status] url: %s, status: %s, headers: %j, xml: %j', url, status, headers, xml);
      return '';
    }
    return xml;
  }

  protected parseItems(xml: string) {
    const items: BinaryItem[] = [];
    // https://nwjs2.s3.amazonaws.com/?prefix=v0.59.0%2Fx64%2F
    // https://chromedriver.storage.googleapis.com/?delimiter=/&prefix=
    // <Contents><Key>2.0/chromedriver_linux32.zip</Key><Generation>1380149859530000</Generation><MetaGeneration>2</MetaGeneration><LastModified>2013-09-25T22:57:39.349Z</LastModified><ETag>"c0d96102715c4916b872f91f5bf9b12c"</ETag><Size>7262134</Size><Owner/></Contents><Contents>
    // <Contents><Key>v0.59.0/nwjs-v0.59.0-linux-ia32.tar.gz</Key><LastModified>2015-11-02T02:34:18.000Z</LastModified><ETag>&quot;b1b7a52928e9f874bad0cabf7f74ba8e&quot;</ETag><Size>22842</Size><StorageClass>STANDARD</StorageClass></Contents>
    const fileRe = /<Contents><Key>([^<]+?)<\/Key>(?:<Generation>\d+?<\/Generation>)?(?:<MetaGeneration>\d+?<\/MetaGeneration>)?<LastModified>([^<]+?)<\/LastModified><ETag>[^<]+?<\/ETag><Size>(\d+?)<\/Size>/g;
    let matchs = xml.matchAll(fileRe);
    for (const m of matchs) {
      const fullname = m[1].trim();
      const name = path.basename(fullname);
      const date = m[2].trim();
      const size = parseInt(m[3].trim());
      items.push({
        name,
        isDir: false,
        url: `${this.distUrl}${fullname}`,
        size,
        date,
      });
    }
    // <CommonPrefixes><Prefix>v0.59.0/x64/</Prefix></CommonPrefixes>
    const dirRe = /<CommonPrefixes><Prefix>([^<]+?)<\/Prefix><\/CommonPrefixes>/g;
    matchs = xml.matchAll(dirRe);
    for (const m of matchs) {
      const fullname = m[1].trim();
      const name = `${path.basename(fullname)}/`;
      items.push({
        name,
        isDir: true,
        url: '',
        size: '-',
        date: '-',
      });
    }
    return items;
  }
}
