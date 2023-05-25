import { SingletonProto } from '@eggjs/tegg';
import { BinaryType } from '../../enum/Binary';
import { AbstractBinary, FetchResult, BinaryItem, BinaryAdapter } from './AbstractBinary';

@SingletonProto()
@BinaryAdapter(BinaryType.ChromeForTesting)
export class ChromeForTestingBinary extends AbstractBinary {
  private dirItems?: {
    [key: string]: BinaryItem[];
  };

  async initFetch() {
    this.dirItems = undefined;
  }

  async fetch(dir: string): Promise<FetchResult | undefined> {
    if (!this.dirItems) {
      this.dirItems = {};
      this.dirItems['/'] = [];
      let chromeVersion = '';

      // exports.PUPPETEER_REVISIONS = Object.freeze({
      //   chrome: '113.0.5672.63',
      //   firefox: 'latest',
      // });
      const unpkgURL = 'https://unpkg.com/puppeteer-core@latest/lib/cjs/puppeteer/revisions.js';
      const text = await this.requestXml(unpkgURL);
      const m = /chrome:\s+\'([\d\.]+)\'\,/.exec(text);
      if (m) {
        chromeVersion = m[1];
      }

      const platforms = [ 'linux64', 'mac-arm64', 'mac-x64', 'win32', 'win64' ];
      const date = new Date().toISOString();
      this.dirItems['/'].push({
        name: `${chromeVersion}/`,
        date,
        size: '-',
        isDir: true,
        url: '',
      });
      this.dirItems[`/${chromeVersion}/`] = [];

      for (const platform of platforms) {
        this.dirItems[`/${chromeVersion}/`].push({
          name: `${platform}/`,
          date,
          size: '-',
          isDir: true,
          url: '',
        });

        // https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing/113.0.5672.63/mac-arm64/chrome-mac-arm64.zip
        const name = `chrome-${platform}.zip`;
        this.dirItems[`/${chromeVersion}/${platform}/`] = [
          {
            name,
            date,
            size: '-',
            isDir: false,
            url: `https://edgedl.me.gvt1.com/edgedl/chrome/chrome-for-testing/${chromeVersion}/${platform}/${name}`,
          },
        ];
      }
    }

    return { items: this.dirItems[dir], nextParams: null };
  }
}
