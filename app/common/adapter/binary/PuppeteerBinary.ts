import { SingletonProto } from '@eggjs/tegg';
import { XMLParser } from 'fast-xml-parser';

import { BinaryType } from '../../enum/Binary.js';
import {
  AbstractBinary,
  BinaryAdapter,
  type BinaryItem,
  type FetchResult,
} from './AbstractBinary.js';

export const platforms = ['Linux_x64', 'Mac', 'Mac_Arm', 'Win', 'Win_x64'];

const MAX_DEPTH = 100;

@SingletonProto()
@BinaryAdapter(BinaryType.Puppeteer)
export class PuppeteerBinary extends AbstractBinary {
  private dirItems?: {
    [key: string]: BinaryItem[];
  };

  async initFetch() {
    this.dirItems = undefined;
  }

  async fetch(
    dir: string,
    _binaryName: string,
    lastData?: Record<string, unknown>
  ): Promise<FetchResult | undefined> {
    if (!this.dirItems) {
      const s3Url = 'https://chromium-browser-snapshots.storage.googleapis.com';
      const chromiumRevisions = new Map<string, string>();
      this.dirItems = {};
      this.dirItems['/'] = [];
      for (const platform of platforms) {
        const revision = lastData?.[platform] as string;
        if (revision) {
          // 丢弃库中历史不带 lastData 的任务，防止遍历任务过多
          this.logger.info(
            'drop puppeteer task if has no last data for platform %s, lastPlatform',
            platform,
            lastData
          );
          return;
        }
        let marker = revision ? `${platform}/${revision}/REVISIONS` : undefined;
        this.dirItems['/'].push({
          name: `${platform}/`,
          date: new Date().toISOString(),
          size: '-',
          isDir: true,
          url: '',
        });
        this.dirItems[`/${platform}/`] = [];
        let i = 0;
        do {
          let requestUrl = s3Url + '?prefix=' + platform;
          if (marker) {
            requestUrl += '&marker=' + marker;
          }
          const xml = await this.requestXml(requestUrl);
          const parser = new XMLParser();
          const obj = parser.parse(xml);
          if (
            obj.ListBucketResult.IsTruncated === true &&
            obj.ListBucketResult.NextMarker
          ) {
            marker = obj.ListBucketResult.NextMarker;
          } else {
            marker = undefined;
          }
          for (const content of obj.ListBucketResult.Contents) {
            // /Linux_x64/1041455/REVISIONS
            if (content.Key.endsWith('/REVISIONS')) {
              const revision = content.Key.split('/')[1].trim();
              chromiumRevisions.set(revision, content.LastModified);
            }
          }
          // 最多遍历 100 次防止内存爆炸，下次同步任务会继续
        } while (i++ < MAX_DEPTH || marker !== undefined);
      }

      for (const [revision, date] of chromiumRevisions.entries()) {
        // https://github.com/puppeteer/puppeteer/blob/eebf452d38b79bb2ea1a1ba84c3d2ea6f2f9f899/src/node/BrowserFetcher.ts#L40
        // chrome: {
        //   linux: '%s/chromium-browser-snapshots/Linux_x64/%d/%s.zip',
        //   mac: '%s/chromium-browser-snapshots/Mac/%d/%s.zip',
        //   win32: '%s/chromium-browser-snapshots/Win/%d/%s.zip',
        //   win64: '%s/chromium-browser-snapshots/Win_x64/%d/%s.zip',
        // },
        // root: /
        for (const platform of platforms) {
          this.dirItems[`/${platform}/`].push({
            name: `${revision}/`,
            date,
            size: '-',
            isDir: true,
            url: '',
          });
          const name = `${this.archiveName(platform, revision)}.zip`;
          this.dirItems[`/${platform}/${revision}/`] = [
            {
              name,
              date,
              size: '-',
              isDir: false,
              url: `https://storage.googleapis.com/chromium-browser-snapshots/${platform}/${revision}/${name}`,
              ignoreDownloadStatuses: [404],
            },
          ];
        }
      }
    }

    return { items: this.dirItems[dir], nextParams: null };
  }

  // https://github.com/puppeteer/puppeteer/blob/eebf452d38b79bb2ea1a1ba84c3d2ea6f2f9f899/src/node/BrowserFetcher.ts#L72
  private archiveName(platform: string, revision: string): string {
    if (platform === 'Linux_x64') return 'chrome-linux';
    if (platform === 'Mac' || platform === 'Mac_Arm') return 'chrome-mac';
    if (platform === 'Win' || platform === 'Win_x64') {
      // Windows archive name changed at r591479.
      return Number.parseInt(revision, 10) > 591_479
        ? 'chrome-win'
        : 'chrome-win32';
    }
    return '';
  }
}
