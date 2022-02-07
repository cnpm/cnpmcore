import { AbstractBinary, FetchResult, BinaryItem } from './AbstractBinary';

export class PuppeteerBinary extends AbstractBinary {
  private dirItems: {
    [key: string]: BinaryItem[];
  };

  async fetch(dir: string): Promise<FetchResult | undefined> {
    if (!this.dirItems) {
      const pkgUrl = 'https://registry.npmjs.com/puppeteer';
      const data = await this.requestJSON(pkgUrl);
      this.dirItems = {};
      this.dirItems['/'] = [];
      const chromiumRevisions = new Map<string, string>();
      for (const version in data.versions) {
        // find chromium versions
        const pkg = data.versions[version];
        const revision = pkg.puppeteer?.chromium_revision ? String(pkg.puppeteer.chromium_revision) : '';
        if (revision && !chromiumRevisions.has(revision)) {
          chromiumRevisions.set(revision, data.time[version]);
        }
      }

      // https://unpkg.com/puppeteer@5.1.0/lib/cjs/revisions.js
      // https://unpkg.com/puppeteer@latest/lib/cjs/puppeteer/revisions.js
      // exports.PUPPETEER_REVISIONS = {
      //   chromium: '768783',
      //   firefox: 'latest',
      // };
      const unpkgURL = 'https://unpkg.com/puppeteer@latest/lib/cjs/puppeteer/revisions.js';
      const text = await this.requestXml(unpkgURL);
      const m = /chromium:\s+\'(\d+)\'\,/.exec(text);
      if (m && !chromiumRevisions.has(m[1])) {
        chromiumRevisions.set(m[1], new Date().toISOString());
      }

      // old versions
      // https://github.com/puppeteer/puppeteer/blob/v8.0.0/src/revisions.ts#L23
      // "8.0.0":"2021-02-26T08:36:50.107Z"
      chromiumRevisions.set('856583', '2021-02-26T08:36:50.107Z');
      // "9.0.0":"2021-04-21T11:27:32.513Z"
      chromiumRevisions.set('869685', '2021-04-21T11:27:32.513Z');
      // "10.0.0":"2021-05-31T12:42:27.486Z"
      chromiumRevisions.set('884014', '2021-05-31T12:42:27.486Z');
      // "11.0.0":"2021-11-03T09:29:12.751Z"
      chromiumRevisions.set('901912', '2021-11-03T09:29:12.751Z');

      const platforms = [ 'Linux_x64', 'Mac', 'Mac_Arm', 'Win', 'Win_x64' ];
      for (const platform of platforms) {
        this.dirItems['/'].push({
          name: `${platform}/`,
          date: new Date().toISOString(),
          size: '-',
          isDir: true,
          url: '',
        });
        this.dirItems[`/${platform}/`] = [];
      }
      for (const [ revision, date ] of chromiumRevisions.entries()) {
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
              ignoreDownloadStatuses: [ 404 ],
            },
          ];
        }
      }
    }

    return { items: this.dirItems[dir], nextParams: null };
  }

  // https://github.com/puppeteer/puppeteer/blob/eebf452d38b79bb2ea1a1ba84c3d2ea6f2f9f899/src/node/BrowserFetcher.ts#L72
  private archiveName(
    platform: string,
    revision: string,
  ): string {
    if (platform === 'Linux_x64') return 'chrome-linux';
    if (platform === 'Mac' || platform === 'Mac_Arm') return 'chrome-mac';
    if (platform === 'Win' || platform === 'Win_x64') {
      // Windows archive name changed at r591479.
      return parseInt(revision, 10) > 591479 ? 'chrome-win' : 'chrome-win32';
    }
    return '';
  }
}
