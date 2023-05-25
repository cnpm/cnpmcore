import { SingletonProto } from '@eggjs/tegg';
import { BinaryType } from '../../enum/Binary';
import binaries, { BinaryName, BinaryTaskConfig } from '../../../../config/binaries';
import path from 'path';
import { AbstractBinary, FetchResult, BinaryItem, BinaryAdapter } from './AbstractBinary';

@SingletonProto()
@BinaryAdapter(BinaryType.Bucket)
export class BucketBinary extends AbstractBinary {
  async initFetch() {
    // do nothing
    return;
  }

  async fetch(dir: string, binaryName: BinaryName): Promise<FetchResult | undefined> {
    // /foo/ => foo/
    const binaryConfig = binaries[binaryName];
    const subDir = dir.substring(1);
    const url = `${binaryConfig.distUrl}?delimiter=/&prefix=${encodeURIComponent(subDir)}`;
    const xml = await this.requestXml(url);
    return { items: this.parseItems(xml, dir, binaryConfig), nextParams: null };
  }

  protected parseItems(xml: string, dir: string, binaryConfig: BinaryTaskConfig): BinaryItem[] {
    const items: BinaryItem[] = [];
    // https://nwjs2.s3.amazonaws.com/?prefix=v0.59.0%2Fx64%2F
    // https://chromedriver.storage.googleapis.com/?delimiter=/&prefix=
    // <Contents><Key>2.0/chromedriver_linux32.zip</Key><Generation>1380149859530000</Generation><MetaGeneration>2</MetaGeneration><LastModified>2013-09-25T22:57:39.349Z</LastModified><ETag>"c0d96102715c4916b872f91f5bf9b12c"</ETag><Size>7262134</Size><Owner/></Contents><Contents>
    // <Contents><Key>v0.59.0/nwjs-v0.59.0-linux-ia32.tar.gz</Key><LastModified>2015-11-02T02:34:18.000Z</LastModified><ETag>&quot;b1b7a52928e9f874bad0cabf7f74ba8e&quot;</ETag><Size>22842</Size><StorageClass>STANDARD</StorageClass></Contents>
    const fileRe = /<Contents><Key>([^<]+?)<\/Key>(?:<Generation>\d+?<\/Generation>)?(?:<MetaGeneration>\d+?<\/MetaGeneration>)?<LastModified>([^<]+?)<\/LastModified><ETag>[^<]+?<\/ETag><Size>(\d+?)<\/Size>/g;
    let matchs = xml.matchAll(fileRe);
    for (const m of matchs) {
      const fullname = m[1].trim();
      // <Key>2.43/</Key>
      // <Generation>1410297711522000</Generation>
      // <MetaGeneration>1</MetaGeneration>
      // <LastModified>2014-09-09T21:21:51.522Z</LastModified>
      // <ETag>"d41d8cd98f00b204e9800998ecf8427e"</ETag>
      // <Size>0</Size>
      // ignore size = 0 dir
      if (fullname.endsWith('/')) continue;

      const name = path.basename(fullname);
      const date = m[2].trim();
      const size = parseInt(m[3].trim());
      items.push({
        name,
        isDir: false,
        url: `${binaryConfig.distUrl}${fullname}`,
        size,
        date,
      });
    }
    // <CommonPrefixes><Prefix>v0.59.0/x64/</Prefix></CommonPrefixes>
    const dirRe = /<CommonPrefixes><Prefix>([^<]+?)<\/Prefix><\/CommonPrefixes>/g;
    matchs = xml.matchAll(dirRe);
    for (const m of matchs) {
      // <Prefix>AWSLogs/</Prefix>
      // ignore AWSLogs
      // Download https://node-inspector.s3.amazonaws.com/AWSLogs/077447786745/CloudTrail/us-west-2/2015/12/10/077447786745_CloudTrail_us-west-2_20151210T1015Z_JNWlbeBTILiSzPCq.json.gz status(403) invalid
      const fullname = m[1].trim();
      const name = `${path.basename(fullname)}/`;
      const fullpath = `${dir}${name}`;
      if (binaryConfig.ignoreDirs?.includes(fullpath)) continue;
      let date = '-';
      // root dir children, should set date to '2022-04-19T01:00:00Z', sync per hour
      if (dir === '/') {
        date = new Date().toISOString().split(':', 1)[0] + ':00:00Z';
      }
      items.push({
        name,
        isDir: true,
        url: '',
        size: '-',
        date,
      });
    }
    return items;
  }
}
