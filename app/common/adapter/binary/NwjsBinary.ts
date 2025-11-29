import { SingletonProto } from 'egg';

import binaries from '../../../../config/binaries.ts';
import { BinaryType } from '../../enum/Binary.ts';
import {
  AbstractBinary,
  BinaryAdapter,
  type BinaryItem,
  type FetchResult,
} from './AbstractBinary.ts';

@SingletonProto()
@BinaryAdapter(BinaryType.Nwjs)
export class NwjsBinary extends AbstractBinary {
  async initFetch() {
    // do nothing
    return;
  }

  async fetch(dir: string): Promise<FetchResult | undefined> {
    const binaryConfig = binaries.nwjs;
    // Fetch all directories from dl.nwjs.io directly (HTML format)
    const url = `${binaryConfig.distUrl}${dir.slice(1)}`;
    const html = await this.requestXml(url);
    if (!html) return;

    const items: BinaryItem[] = [];
    // Parse Apache directory listing HTML format:
    // Directories:
    // <tr><td valign="top"><img src="/icons/folder.gif" alt="[DIR]"></td><td><a href="v0.14.7/">v0.14.7/</a></td><td align="right">22-Jul-2016 17:08  </td><td align="right">  - </td><td>&nbsp;</td></tr>
    // Files:
    // <tr><td valign="top"><img src="/icons/unknown.gif" alt="[   ]"></td><td><a href="MD5SUMS">MD5SUMS</a></td><td align="right">30-Jul-2015 02:21  </td><td align="right"> 31K</td><td>&nbsp;</td></tr>
    // <tr><td valign="top"><img src="/icons/compressed.gif" alt="[   ]"></td><td><a href="nwjs-v0.59.0-win-x64.zip">nwjs-v0.59.0-win-x64.zip</a></td><td align="right">02-Dec-2021 23:35  </td><td align="right">106M</td><td>&nbsp;</td></tr>
    const re =
      /<td><a [^>]*href="([^"]+)"[^>]*>([^<]+)<\/a><\/td><td[^>]*>([^<]*)<\/td><td[^>]*>([^<]*)<\/td>/gi;
    const matchs = html.matchAll(re);
    for (const m of matchs) {
      const href = m[1].trim();
      const name = m[2].trim();
      const date = m[3].trim();
      const sizeStr = m[4].trim();

      // Skip parent directory and certain special directories
      if (name === 'Parent Directory') continue;
      if (href === 'live-build/') continue;

      const isDir = href.endsWith('/');
      const fileUrl = isDir ? '' : `${binaryConfig.distUrl}${dir.slice(1)}${href}`;

      items.push({
        name: isDir ? href : name,
        isDir,
        url: fileUrl,
        size: sizeStr === '-' ? '-' : sizeStr,
        date: date || '-',
      });
    }

    return { items, nextParams: null };
  }
}
