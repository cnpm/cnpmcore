import { SingletonProto } from 'egg';

import binaries, { type BinaryName } from '../../../../config/binaries.ts';
import { BinaryType } from '../../enum/Binary.ts';
import { GithubBinary } from './GithubBinary.ts';
import {
  BinaryAdapter,
  type BinaryItem,
  type FetchResult,
} from './AbstractBinary.ts';

@SingletonProto()
@BinaryAdapter(BinaryType.Electron)
export class ElectronBinary extends GithubBinary {
  async fetch(
    dir: string,
    binaryName: BinaryName = 'electron'
  ): Promise<FetchResult | undefined> {
    const releases = await this.initReleases(binaryName, binaries.electron);
    if (!releases) return;

    let items: BinaryItem[] = [];
    if (dir === '/') {
      for (const item of releases) {
        items.push({
          name: `${item.tag_name}/`,
          isDir: true,
          url: item.url,
          size: '-',
          date: item.published_at,
        });
        // v14.2.6 => 14.2.6
        if (/^v\d+?\./.test(item.tag_name)) {
          items.push({
            name: `${item.tag_name.slice(1)}/`,
            isDir: true,
            url: item.url,
            size: '-',
            date: item.published_at,
          });
        }
      }
    } else {
      for (const item of releases) {
        if (
          dir === `/${item.tag_name}/` ||
          dir === `/${item.tag_name.slice(1)}/`
        ) {
          items = this.formatItems(item, binaries.electron);
          break;
        }
      }
    }

    return { items };
  }
}
