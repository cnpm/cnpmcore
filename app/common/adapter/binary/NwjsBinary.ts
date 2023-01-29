import { SingletonProto } from '@eggjs/tegg';
import { BinaryType } from '../../enum/Binary';
import binaries from 'config/binaries';
import { FetchResult, BinaryItem, BinaryAdapter } from './AbstractBinary';
import { BucketBinary } from './BucketBinary';

@SingletonProto()
@BinaryAdapter(BinaryType.Nwjs)
export class NwjsBinary extends BucketBinary {
  private s3Url = 'https://nwjs2.s3.amazonaws.com/?delimiter=/&prefix=';

  async fetch(dir: string): Promise<FetchResult | undefined> {
    const binaryConfig = binaries.nwjs;
    const isRootDir = dir === '/';
    // /foo/ => foo/
    const subDir = dir.substring(1);
    const url = isRootDir ? binaryConfig.distUrl : `${this.s3Url}${encodeURIComponent(subDir)}`;
    const xml = await this.requestXml(url);
    if (!xml) return;

    if (isRootDir) {
      // <tr><td valign="top"><img src="/icons/folder.gif" alt="[DIR]"></td><td><a href="v0.14.7/">v0.14.7/</a></td><td align="right">22-Jul-2016 17:08  </td><td align="right">  - </td><td>&nbsp;</td></tr>
      // <tr><td valign="top"><img src="/icons/folder.gif" alt="[DIR]"></td><td><a href="v0.15.0-beta1/">v0.15.0-beta1/</a></td><td align="right">27-Apr-2016 12:17  </td><td align="right">  - </td><td>&nbsp;</td></tr>
      // <tr><td valign="top"><img src="/icons/folder.gif" alt="[DIR]"></td><td><a href="v0.15.0-beta2/">v0.15.0-beta2/</a></td><td align="right">03-May-2016 17:17  </td><td align="right">  - </td><td>&nbsp;</td></tr>
      // <tr><td valign="top"><img src="/icons/folder.gif" alt="[DIR]"></td><td><a href="v0.15.0-rc1/">v0.15.0-rc1/</a></td><td align="right">06-May-2016 12:24  </td><td align="right">  - </td><td>&nbsp;</td></tr>
      // <tr><td valign="top"><img src="/icons/folder.gif" alt="[DIR]"></td><td><a href="v0.15.0-rc2/">v0.15.0-rc2/</a></td><td align="right">13-May-2016 20:13  </td><td align="right">  - </td><td>&nbsp;</td></tr>
      const items: BinaryItem[] = [];
      const re = /<td><a [^>]+?>([^<]+?\/)<\/a><\/td><td [^>]+?>([^>]+?)<\/td>/ig;
      const matchs = xml.matchAll(re);
      for (const m of matchs) {
        const name = m[1].trim();
        // ignore	live-build/ name
        if (name === 'live-build/') continue;
        const date = m[2].trim();
        items.push({
          name,
          isDir: true,
          url: '',
          size: '-',
          date,
        });
      }
      return { items, nextParams: null };
    }

    return { items: this.parseItems(xml, dir, binaryConfig), nextParams: null };
  }
}
