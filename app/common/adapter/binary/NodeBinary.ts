import { SingletonProto } from '@eggjs/tegg';
import { BinaryType } from '../../enum/Binary';
import binaries, { BinaryName } from '../../../../config/binaries';
import { AbstractBinary, FetchResult, BinaryItem, BinaryAdapter } from './AbstractBinary';

@SingletonProto()
@BinaryAdapter(BinaryType.Node)
export class NodeBinary extends AbstractBinary {
  async initFetch() {
    // do nothing
    return;
  }

  async fetch(dir: string, binaryName: BinaryName): Promise<FetchResult | undefined> {
    const binaryConfig = binaries[binaryName];
    const url = `${binaryConfig.distUrl}${dir}`;
    const html = await this.requestXml(url);
    // <a href="v9.8.0/">v9.8.0/</a>                                            08-Mar-2018 01:55                   -
    // <a href="v9.9.0/">v9.9.0/</a>                                            21-Mar-2018 15:47                   -
    // <a href="index.json">index.json</a>                                         17-Dec-2021 23:16              219862
    // <a href="index.tab">index.tab</a>                                          17-Dec-2021 23:16              136319
    // <a href="node-0.0.1.tar.gz">node-0.0.1.tar.gz</a>                                  26-Aug-2011 16:22             2846972
    // <a href="node-v14.0.0-nightly20200119b318926634-linux-armv7l.tar.xz">node-v14.0.0-nightly20200119b318926634-linux-ar..&gt;</a> 19-Jan-2020 06:07            18565976
    const re = /<a href="([^\"]+?)"[^>]*?>[^<]+?<\/a>\s+?([\w\-]+? \w{2}\:\d{2})\s+?(\d+|\-)/ig;
    const matchs = html.matchAll(re);
    const items: BinaryItem[] = [];
    for (const m of matchs) {
      const name = m[1];
      const isDir = name.endsWith('/');
      const fileUrl = isDir ? '' : `${url}${name}`;
      const date = m[2];
      const size = m[3];
      if (size === '0') continue;
      if (binaryConfig.ignoreFiles?.includes(`${dir}${name}`)) continue;

      items.push({
        name,
        isDir,
        url: fileUrl,
        size,
        date,
        ignoreDownloadStatuses: binaryConfig.options?.ignoreDownloadStatuses,
      });
    }
    return { items, nextParams: null };
  }
}
