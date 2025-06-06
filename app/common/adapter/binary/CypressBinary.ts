import { SingletonProto } from '@eggjs/tegg';
import { BinaryType } from '../../enum/Binary.js';
import {
  AbstractBinary,
  BinaryAdapter,
  type BinaryItem,
  type FetchResult,
} from './AbstractBinary.js';

@SingletonProto()
@BinaryAdapter(BinaryType.Cypress)
export class CypressBinary extends AbstractBinary {
  private dirItems?: {
    [key: string]: BinaryItem[];
  } | null;

  async initFetch() {
    this.dirItems = undefined;
  }

  async fetch(dir: string): Promise<FetchResult | undefined> {
    if (!this.dirItems) {
      const pkgUrl = 'https://registry.npmjs.com/cypress';
      const data = await this.requestJSON(pkgUrl);
      this.dirItems = {};
      this.dirItems['/'] = [];
      for (const version in data.versions) {
        const major = Number.parseInt(version.split('.', 1)[0]);
        // need >= 4.0.0
        // https://npmmirror.com/mirrors/cypress/4.0.0/
        if (major < 4) continue;
        const date = data.time[version];
        // root: /
        this.dirItems['/'].push({
          name: `${version}/`,
          date,
          size: '-',
          isDir: true,
          url: '',
        });
        // version dir: /x.x.x/
        const subDir = `/${version}/`;
        if (!this.dirItems[subDir]) this.dirItems[subDir] = [];
        // "https://cdn.cypress.io/desktop/4.0.0/darwin-x64/cypress.zip"
        // "https://cdn.cypress.io/desktop/4.0.0/linux-x64/cypress.zip"
        // "https://cdn.cypress.io/desktop/4.0.0/win32-x64/cypress.zip"
        // "https://cdn.cypress.io/desktop/9.2.0/darwin-arm64/cypress.zip"
        // "https://cdn.cypress.io/desktop/9.2.0/darwin-x64/cypress.zip"
        // "https://cdn.cypress.io/desktop/9.2.0/linux-x64/cypress.zip"
        // "https://cdn.cypress.io/desktop/9.2.0/linux-arm64/cypress.zip"
        // "https://cdn.cypress.io/desktop/9.2.0/win32-x64/cypress.zip"
        // https://github.com/cypress-io/cypress/blob/develop/scripts/binary/index.js#L146
        // const systems = [
        //   { platform: 'linux', arch: 'x64' },
        //   { platform: 'linux', arch: 'arm64' },
        //   { platform: 'darwin', arch: 'x64' },
        //   { platform: 'darwin', arch: 'arm64' },
        //   { platform: 'win32', arch: 'x64' },
        // ]
        const platforms = [
          'darwin-x64',
          'darwin-arm64',
          'linux-x64',
          'linux-arm64',
          'win32-x64',
        ];
        for (const platform of platforms) {
          this.dirItems[subDir].push({
            name: `${platform}/`,
            date,
            size: '-',
            isDir: true,
            url: '',
          });
          // version dir: /x.x.x/darwin-x64/
          this.dirItems[`/${version}/${platform}/`] = [
            {
              name: 'cypress.zip',
              date,
              size: '-',
              isDir: false,
              url: `https://cdn.cypress.io/desktop/${version}/${platform}/cypress.zip`,
            },
          ];
        }
      }
    }

    return { items: this.dirItems[dir], nextParams: null };
  }
}
