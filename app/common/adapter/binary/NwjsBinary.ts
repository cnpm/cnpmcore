import path from 'path';
import { AbstractBinary, FetchResult, BinaryItem } from './AbstractBinary';

export class NwjsBinary extends AbstractBinary {
  private distUrl = 'https://dl.nwjs.io/';
  // https://nwjs2.s3.amazonaws.com/?delimiter=/&prefix=v0.59.0%2Fx64%2F
  private s3Url = 'https://nwjs2.s3.amazonaws.com/?delimiter=/&prefix=';

  async fetch(dir: string): Promise<FetchResult | undefined> {
    const isRootDir = dir === '/';
    // /foo/ => foo/
    const subDir = dir.substring(1);
    const url = isRootDir ? this.distUrl : `${this.s3Url}${encodeURIComponent(subDir)}`;
    const { status, data, headers } = await this.httpclient.request(url, {
      timeout: 20000,
    });
    const text = data.toString() as string;
    if (status !== 200) {
      this.logger.warn('[NodeBinary.fetch:non-200-status] status: %s, headers: %j, text: %j', status, headers, text);
      return;
    }
    const items: BinaryItem[] = [];
    if (isRootDir) {
      // <tr><td valign="top"><img src="/icons/folder.gif" alt="[DIR]"></td><td><a href="v0.14.7/">v0.14.7/</a></td><td align="right">22-Jul-2016 17:08  </td><td align="right">  - </td><td>&nbsp;</td></tr>
      // <tr><td valign="top"><img src="/icons/folder.gif" alt="[DIR]"></td><td><a href="v0.15.0-beta1/">v0.15.0-beta1/</a></td><td align="right">27-Apr-2016 12:17  </td><td align="right">  - </td><td>&nbsp;</td></tr>
      // <tr><td valign="top"><img src="/icons/folder.gif" alt="[DIR]"></td><td><a href="v0.15.0-beta2/">v0.15.0-beta2/</a></td><td align="right">03-May-2016 17:17  </td><td align="right">  - </td><td>&nbsp;</td></tr>
      // <tr><td valign="top"><img src="/icons/folder.gif" alt="[DIR]"></td><td><a href="v0.15.0-rc1/">v0.15.0-rc1/</a></td><td align="right">06-May-2016 12:24  </td><td align="right">  - </td><td>&nbsp;</td></tr>
      // <tr><td valign="top"><img src="/icons/folder.gif" alt="[DIR]"></td><td><a href="v0.15.0-rc2/">v0.15.0-rc2/</a></td><td align="right">13-May-2016 20:13  </td><td align="right">  - </td><td>&nbsp;</td></tr>
      const re = /<td><a [^>]+?>([^<]+?\/)<\/a><\/td><td [^>]+?>([^>]+?)<\/td>/ig;
      const matchs = text.matchAll(re);
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
    } else {
      // sub dir
      // https://nwjs2.s3.amazonaws.com/?prefix=v0.59.0%2Fx64%2F
      // <Contents><Key>v0.59.0/nwjs-v0.59.0-linux-ia32.tar.gz</Key><LastModified>2015-11-02T02:34:18.000Z</LastModified><ETag>&quot;b1b7a52928e9f874bad0cabf7f74ba8e&quot;</ETag><Size>22842</Size><StorageClass>STANDARD</StorageClass></Contents>
      const fileRe = /<Contents><Key>([^<]+?)<\/Key><LastModified>([^<]+?)<\/LastModified><ETag>[^<]+?<\/ETag><Size>(\d+?)<\/Size><StorageClass>[^<]+?<\/StorageClass><\/Contents>/g;
      let matchs = text.matchAll(fileRe);
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
      matchs = text.matchAll(dirRe);
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
    }

    return { items, nextParams: null };
  }
}
