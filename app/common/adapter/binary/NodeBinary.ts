import { basename } from 'node:path';

import { SingletonProto } from 'egg';
import dayjs from 'dayjs';

import binaries, { type BinaryName } from '../../../../config/binaries.ts';
import { BinaryType } from '../../enum/Binary.ts';
import {
  AbstractBinary,
  BinaryAdapter,
  type BinaryItem,
  type FetchResult,
} from './AbstractBinary.ts';

@SingletonProto()
@BinaryAdapter(BinaryType.Node)
export class NodeBinary extends AbstractBinary {
  async initFetch() {
    // do nothing
    return;
  }

  async fetch(
    dir: string,
    binaryName: BinaryName
  ): Promise<FetchResult | undefined> {
    const binaryConfig = binaries[binaryName];
    const url = `${binaryConfig.distUrl}${dir}`;
    const html = await this.requestXml(url);

    // <a href="v9.8.0/">v9.8.0/</a>                                            08-Mar-2018 01:55                   -
    // <a href="v9.9.0/">v9.9.0/</a>                                            21-Mar-2018 15:47                   -
    // <a href="index.json">index.json</a>                                         17-Dec-2021 23:16              219862
    // <a href="index.tab">index.tab</a>                                          17-Dec-2021 23:16              136319
    // <a href="node-0.0.1.tar.gz">node-0.0.1.tar.gz</a>                                  26-Aug-2011 16:22             2846972
    // <a href="node-v14.0.0-nightly20200119b318926634-linux-armv7l.tar.xz">node-v14.0.0-nightly20200119b318926634-linux-ar..&gt;</a> 19-Jan-2020 06:07            18565976

    // new html format
    //     <a href="docs/">docs/</a>                                                             -                   -
    // <a href="win-x64/">win-x64/</a>                                                          -                   -
    // <a href="win-x86/">win-x86/</a>                                                          -                   -
    // <a href="/dist/v18.15.0/SHASUMS256.txt.asc">SHASUMS256.txt.asc</a>                                 04-Nov-2024 17:29               3.7 KB
    // <a href="/dist/v18.15.0/SHASUMS256.txt.sig">SHASUMS256.txt.sig</a>                                 04-Nov-2024 17:29                310 B
    // <a href="/dist/v18.15.0/SHASUMS256.txt">SHASUMS256.txt</a>                                     04-Nov-2024 17:29               3.2 KB

    // <a href="/dist/latest-v20.x/SHASUMS256.txt.asc">SHASUMS256.txt.asc</a>                                 03 Sept 2025, 18:20               4.7 KB
    // <a href="/dist/latest-v20.x/SHASUMS256.txt.sig">SHASUMS256.txt.sig</a>                                 03 Sept 2025, 18:20                566 B
    // <a href="/dist/latest-v20.x/SHASUMS256.txt">SHASUMS256.txt</a>                                     03 Sept 2025, 18:19               3.8 KB
    // <a href="/dist/latest-v20.x/node-v20.19.5-aix-ppc64.tar.gz">node-v20.19.5-aix-ppc64.tar.gz</a>                     03 Sept 2025, 18:19                60 MB
    // <a href="/dist/latest-v20.x/node-v20.19.5-arm64.msi">node-v20.19.5-arm64.msi</a>                            03 Sept 2025, 18:19                24 MB
    // <a href="/dist/latest-v20.x/node-v20.19.5-darwin-arm64.tar.gz">node-v20.19.5-darwin-arm64.tar.gz</a>                  03 Sept 2025, 18:19                41 MB
    // <a href="/dist/latest-v20.x/node-v20.19.5-darwin-arm64.tar.xz">node-v20.19.5-darwin-arm64.tar.xz</a>                  03 Sept 2025, 18:19                21 MB
    // <a href="/dist/latest-v20.x/node-v20.19.5-darwin-x64.tar.gz">node-v20.19.5-darwin-x64.tar.gz</a>                    03 Sept 2025, 18:19                43 MB
    // <a href="/dist/latest-v20.x/node-v20.19.5-darwin-x64.tar.xz">node-v20.19.5-darwin-x64.tar.xz</a>                    03 Sept 2025, 18:19                23 MB
    // <a href="/dist/latest-v20.x/node-v20.19.5-headers.tar.gz">node-v20.19.5-headers.tar.gz</a>                       03 Sept 2025, 18:19               8.7 MB
    // <a href="/dist/latest-v20.x/node-v20.19.5-headers.tar.xz">node-v20.19.5-headers.tar.xz</a>                       03 Sept 2025, 18:19               524 KB
    // <a href="/dist/latest-v20.x/node-v20.19.5-linux-arm64.tar.gz">node-v20.19.5-linux-arm64.tar.gz</a>                   03 Sept 2025, 18:19                47 MB
    // <a href="/dist/latest-v20.x/node-v20.19.5-linux-arm64.tar.xz">node-v20.19.5-linux-arm64.tar.xz</a>                   03 Sept 2025, 18:19                25 MB
    // <a href="/dist/latest-v20.x/node-v20.19.5-linux-armv7l.tar.gz">node-v20.19.5-linux-armv7l.tar.gz</a>                  03 Sept 2025, 18:19                43 MB
    // <a href="/dist/latest-v20.x/node-v20.19.5-linux-armv7l.tar.xz">node-v20.19.5-linux-armv7l.tar.xz</a>                  03 Sept 2025, 18:19                22 MB
    // <a href="/dist/latest-v20.x/node-v20.19.5-linux-ppc64le.tar.gz">node-v20.19.5-linux-ppc64le.tar.gz</a>                 03 Sept 2025, 18:19                49 MB
    // <a href="/dist/latest-v20.x/node-v20.19.5-linux-ppc64le.tar.xz">node-v20.19.5-linux-ppc64le.tar.xz</a>                 03 Sept 2025, 18:19                26 MB
    // <a href="/dist/latest-v20.x/node-v20.19.5-linux-s390x.tar.gz">node-v20.19.5-linux-s390x.tar.gz</a>                   03 Sept 2025, 18:19                47 MB
    // <a href="/dist/latest-v20.x/node-v20.19.5-linux-s390x.tar.xz">node-v20.19.5-linux-s390x.tar.xz</a>                   03 Sept 2025, 18:19                25 MB
    // <a href="/dist/latest-v20.x/node-v20.19.5-linux-x64.tar.gz">node-v20.19.5-linux-x64.tar.gz</a>                     03 Sept 2025, 18:19                47 MB
    // <a href="/dist/latest-v20.x/node-v20.19.5-linux-x64.tar.xz">node-v20.19.5-linux-x64.tar.xz</a>                     03 Sept 2025, 18:19                26 MB
    // <a href="/dist/latest-v20.x/node-v20.19.5-win-arm64.7z">node-v20.19.5-win-arm64.7z</a>                         03 Sept 2025, 18:19                17 MB
    // <a href="/dist/latest-v20.x/node-v20.19.5-win-arm64.zip">node-v20.19.5-win-arm64.zip</a>                        03 Sept 2025, 18:19                26 MB
    // <a href="/dist/latest-v20.x/node-v20.19.5-win-x64.7z">node-v20.19.5-win-x64.7z</a>                           03 Sept 2025, 18:19                19 MB
    // <a href="/dist/latest-v20.x/node-v20.19.5-win-x64.zip">node-v20.19.5-win-x64.zip</a>                          03 Sept 2025, 18:19                30 MB
    // <a href="/dist/latest-v20.x/node-v20.19.5-win-x86.7z">node-v20.19.5-win-x86.7z</a>                           03 Sept 2025, 18:19                18 MB
    // <a href="/dist/latest-v20.x/node-v20.19.5-win-x86.zip">node-v20.19.5-win-x86.zip</a>                          03 Sept 2025, 18:19                28 MB
    // <a href="/dist/latest-v20.x/node-v20.19.5-x64.msi">node-v20.19.5-x64.msi</a>                              03 Sept 2025, 18:19                27 MB
    // <a href="/dist/latest-v20.x/node-v20.19.5-x86.msi">node-v20.19.5-x86.msi</a>                              03 Sept 2025, 18:19                25 MB
    // <a href="/dist/latest-v20.x/node-v20.19.5.pkg">node-v20.19.5.pkg</a>                                  03 Sept 2025, 18:19                72 MB
    // <a href="/dist/latest-v20.x/node-v20.19.5.tar.gz">node-v20.19.5.tar.gz</a>                               03 Sept 2025, 18:19                89 MB
    // <a href="/dist/latest-v20.x/node-v20.19.5.tar.xz">node-v20.19.5.tar.xz</a>                               03 Sept 2025, 18:19                43 MB

    // date format: 19-Jan-2020 06:07 or 03 Sept 2025, 18:19
    const re =
      /<a href="([^"]+?)"[^>]*?>[^<]+?<\/a>\s+?((?:[\w-]+? \w{2}:\d{2})|(?:\d{2} [A-Za-z]{3,9} \d{4}, \d{2}:\d{2})|-)\s+?([\d.\-\s\w]+)/gi;
    const matchs = html.matchAll(re);
    const items: BinaryItem[] = [];
    for (const m of matchs) {
      let name = m[1];
      const isDir = name.endsWith('/');
      if (!isDir) {
        // /dist/v18.15.0/SHASUMS256.txt => SHASUMS256.txt
        name = basename(name);
      }
      const fileUrl = isDir ? '' : `${url}${name}`;
      const date = m[2] === '-' ? '-' : dayjs(m[2]).format('DD-MMM-YYYY HH:mm');
      const size = m[3].trim();
      if (size === '0') continue;
      if (binaryConfig.ignoreFiles?.includes(`${dir}${name}`)) continue;

      const item = {
        name,
        isDir,
        url: fileUrl,
        size,
        date,
        ignoreDownloadStatuses: binaryConfig.options?.ignoreDownloadStatuses,
      };
      items.push(item);
    }
    return { items, nextParams: null };
  }
}
