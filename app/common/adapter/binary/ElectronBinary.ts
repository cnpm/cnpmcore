import { SingletonProto } from 'egg';

import binaries, { type BinaryName } from '../../../../config/binaries.ts';
import { BinaryType } from '../../enum/Binary.ts';
import { BinaryAdapter, type BinaryItem, type FetchResult } from './AbstractBinary.ts';
import { GithubBinary } from './GithubBinary.ts';

@SingletonProto()
@BinaryAdapter(BinaryType.Electron)
export class ElectronBinary extends GithubBinary {
  async fetch(dir: string, binaryName: BinaryName = 'electron'): Promise<FetchResult | undefined> {
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
      // Check if it's a win-* subdirectory (e.g., /v22.20.0/win-x64/)
      const winPlatforms = ['win-x86', 'win-x64', 'win-arm64'];
      for (const item of releases) {
        const versionWithV = item.tag_name.startsWith('v') ? item.tag_name : `v${item.tag_name}`;
        const versionWithoutV = item.tag_name.startsWith('v') ? item.tag_name.slice(1) : item.tag_name;
        for (const platform of winPlatforms) {
          if (dir === `/${versionWithV}/${platform}/` || dir === `/${versionWithoutV}/${platform}/`) {
            items.push({
              name: 'node.lib',
              isDir: false,
              url: `https://www.electronjs.org/headers/${versionWithV}/${platform}/node.lib`,
              size: '-',
              date: item.published_at,
            });
            return { items };
          }
        }
      }

      // Handle version directory (e.g., /v22.20.0/ or /22.20.0/)
      for (const item of releases) {
        if (dir === `/${item.tag_name}/` || dir === `/${item.tag_name.slice(1)}/`) {
          items = this.formatItems(item, binaries.electron);
          const versionWithV = item.tag_name.startsWith('v') ? item.tag_name : `v${item.tag_name}`;
          // add headers file, e.g. https://www.electronjs.org/headers/v37.7.0/node-v37.7.0-headers.tar.gz
          items.push({
            name: `node-${versionWithV}-headers.tar.gz`,
            isDir: false,
            url: `https://www.electronjs.org/headers/${versionWithV}/node-${versionWithV}-headers.tar.gz`,
            size: '-',
            date: item.published_at,
          });

          // add Windows platform directories
          for (const platform of winPlatforms) {
            items.push({
              name: `${platform}/`,
              isDir: true,
              url: '',
              size: '-',
              date: item.published_at,
            });
          }
          break;
        }
      }
    }

    return { items };
  }
}
