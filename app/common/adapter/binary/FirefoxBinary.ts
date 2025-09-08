import { basename } from 'node:path';
import { SingletonProto } from '@eggjs/tegg';
import binaries, { type BinaryName } from '../../../../config/binaries.js';
import dayjs from 'dayjs';
import { BinaryType } from '../../enum/Binary.js';
import {
  AbstractBinary,
  BinaryAdapter,
  type BinaryItem,
  type FetchResult,
} from './AbstractBinary.js';

@SingletonProto()
@BinaryAdapter(BinaryType.Firefox)
export class FirefoxBinary extends AbstractBinary {
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

    // Mozilla archive has format like:
    // <td><a href="131.0.3/">131.0.3/</a></td><td align="right">2024-10-28 20:13  </td><td align="right">  - </td>
    // <td><a href="firefox-131.0.3.tar.bz2">firefox-131.0.3.tar.bz2</a></td><td align="right">2024-10-28 19:58  </td><td align="right">139M</td>

    // Parse Mozilla directory listing format (table-based HTML)
    const re =
      /<td><a href="([^"]+?)"[^>]*?>[^<]+?<\/a><\/td><td align="right">(\d{4}-\d{2}-\d{2} \d{2}:\d{2}|-)[^<]*?<\/td><td align="right">\s*([\d.\-\s\wMKG]+|-)\s*<\/td>/gi;
    const matchs = html.matchAll(re);
    const items: BinaryItem[] = [];
    
    for (const m of matchs) {
      let name = m[1];
      const isDir = name.endsWith('/');
      if (!isDir) {
        // Keep the full name for files
        name = basename(name);
      }
      const fileUrl = isDir ? '' : `${url}${name}`;
      const dateStr = m[2];
      const date = dateStr === '-' ? '-' : dayjs(dateStr).format('DD-MMM-YYYY HH:mm');
      const size = m[3].trim();
      
      // Skip parent directory links and empty entries
      if (name === '../' || size === '0') continue;
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