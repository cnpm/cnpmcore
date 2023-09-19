import { basename } from 'path';
import { SingletonProto } from '@eggjs/tegg';
import { BinaryType } from '../../enum/Binary';
import { AbstractBinary, FetchResult, BinaryItem, BinaryAdapter } from './AbstractBinary';

@SingletonProto()
@BinaryAdapter(BinaryType.ChromeForTesting)
export class ChromeForTestingBinary extends AbstractBinary {
  static lastTimestamp = '';

  private dirItems?: {
    [key: string]: BinaryItem[];
  };

  async initFetch() {
    this.dirItems = undefined;
  }

  async #syncDirItems() {
    this.dirItems = {};
    this.dirItems['/'] = [];
    const jsonApiEndpoint = 'https://googlechromelabs.github.io/chrome-for-testing/known-good-versions-with-downloads.json';
    const { data } = await this.httpclient.request(jsonApiEndpoint, {
      dataType: 'json',
      timeout: 30000,
      followRedirect: true,
      gzip: true,
    });
    if (data.timestamp === ChromeForTestingBinary.lastTimestamp) return;

    // "timestamp": "2023-09-16T00:21:21.964Z",
    // "versions": [
    //   {
    //     "version": "113.0.5672.0",
    //     "revision": "1121455",
    //     "downloads": {
    //       "chrome": [
    //         {
    //           "platform": "linux64",
    //           "url": "https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing/113.0.5672.0/linux64/chrome-linux64.zip"
    //         },
    //         {
    //           "platform": "mac-arm64",
    //           "url": "https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing/113.0.5672.0/mac-arm64/chrome-mac-arm64.zip"
    //         },
    //         {
    //           "platform": "mac-x64",
    //           "url": "https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing/113.0.5672.0/mac-x64/chrome-mac-x64.zip"
    //         },
    //         {
    //           "platform": "win32",
    //           "url": "https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing/113.0.5672.0/win32/chrome-win32.zip"
    //         },
    //         {
    //           "platform": "win64",
    //           "url": "https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing/113.0.5672.0/win64/chrome-win64.zip"
    //         }
    //       ]
    //     }
    //   },
    const versions = data.versions as {
      version: string;
      revision: string;
      downloads: {
        [key: string]: {
          platform: string;
          url: string;
        }[];
      };
    }[];
    for (const item of versions) {
      this.dirItems['/'].push({
        name: `${item.version}/`,
        date: item.revision,
        size: '-',
        isDir: true,
        url: '',
      });
      const versionDir = `/${item.version}/`;
      if (!this.dirItems[versionDir]) {
        this.dirItems[versionDir] = [];
      }
      for (const category in item.downloads) {
        const downloads = item.downloads[category];
        for (const download of downloads) {
          const platformDir = `${versionDir}${download.platform}/`;
          if (!this.dirItems[platformDir]) {
            this.dirItems[platformDir] = [];
            this.dirItems[versionDir].push({
              name: `${download.platform}/`,
              date: item.revision,
              size: '-',
              isDir: true,
              url: '',
            });
          }
          this.dirItems[platformDir].push({
            name: basename(download.url),
            date: data.timestamp,
            size: '-',
            isDir: false,
            url: download.url,
          });
        }
      }
    }
    ChromeForTestingBinary.lastTimestamp = data.timestamp;
  }

  async fetch(dir: string): Promise<FetchResult | undefined> {
    // use https://github.com/GoogleChromeLabs/chrome-for-testing#json-api-endpoints
    if (!this.dirItems) {
      await this.#syncDirItems();
    }
    return { items: this.dirItems![dir], nextParams: null };
  }
}
