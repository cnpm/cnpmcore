import { SingletonProto } from '@eggjs/tegg';
import { BinaryType } from '../../enum/Binary';
import { AbstractBinary, FetchResult, BinaryAdapter } from './AbstractBinary';

@SingletonProto()
@BinaryAdapter(BinaryType.Cypress)
export class CypressBinary extends AbstractBinary {

  async fetch(dir: string, _, { dirItems }): Promise<FetchResult | undefined> {
    if (!dirItems) {
      dirItems = { '/': [],
      };
      const pkgUrl = 'https://registry.npmjs.com/cypress';
      const data = await this.requestJSON(pkgUrl);
      for (const version in data.versions) {
        const major = parseInt(version.split('.', 1)[0]);
        // need >= 4.0.0
        // https://npmmirror.com/mirrors/cypress/4.0.0/
        if (major < 4) continue;
        const date = data.time[version];
        // root: /
        dirItems['/'].push({
          name: `${version}/`,
          date,
          size: '-',
          isDir: true,
          url: '',
        });
        // version dir: /x.x.x/
        const subDir = `/${version}/`;
        if (!dirItems[subDir]) dirItems[subDir] = [];
        // "https://cdn.cypress.io/desktop/4.0.0/darwin-x64/cypress.zip"
        // "https://cdn.cypress.io/desktop/4.0.0/linux-x64/cypress.zip"
        // "https://cdn.cypress.io/desktop/4.0.0/win32-x64/cypress.zip"
        // "https://cdn.cypress.io/desktop/9.2.0/darwin-arm64/cypress.zip"
        // "https://cdn.cypress.io/desktop/9.2.0/darwin-x64/cypress.zip"
        // "https://cdn.cypress.io/desktop/9.2.0/linux-x64/cypress.zip"
        // "https://cdn.cypress.io/desktop/9.2.0/win32-x64/cypress.zip"
        const platforms = [ 'darwin-x64', 'darwin-arm64', 'linux-x64', 'win32-x64' ];
        for (const platform of platforms) {
          dirItems[subDir].push({
            name: `${platform}/`,
            date,
            size: '-',
            isDir: true,
            url: '',
          });
          // version dir: /x.x.x/darwin-x64/
          dirItems[`/${version}/${platform}/`] = [
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

    return { items: dirItems[dir], nextParams: null, cache: { dirItems } };
  }
}
