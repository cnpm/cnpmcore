import { AbstractBinary, FetchResult, BinaryItem } from './AbstractBinary';

export class GithubBinary extends AbstractBinary {
  private releases?: any[];

  protected async initReleases() {
    if (!this.releases) {
      // https://docs.github.com/en/rest/reference/releases get three pages
      // https://api.github.com/repos/electron/electron/releases
      // https://api.github.com/repos/electron/electron/releases?per_page=100&page=3
      let releases: any[] = [];
      const maxPage = this.binaryConfig.options?.maxPage || 1;
      for (let i = 0; i < maxPage; i++) {
        const url = `https://api.github.com/repos/${this.binaryConfig.repo}/releases?per_page=100&page=${i + 1}`;
        const data = await this.requestJSON(url);
        if (!Array.isArray(data)) {
          // {"message":"API rate limit exceeded for 47.57.239.54. (But here's the good news: Authenticated requests get a higher rate limit. Check out the documentation for more details.)","documentation_url":"https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting"}
          if (typeof data?.message === 'string' && data.message.includes('rate limit')) {
            this.logger.info('[GithubBinary.fetch:hit-rate-limit] skip sync this time, data: %j, url: %s', data, url);
            return;
          }
          this.logger.warn('[GithubBinary.fetch:response-data-not-array] data: %j, url: %s', data, url);
          return;
        }
        releases = releases.concat(data);
      }
      this.releases = releases;
    }
    return this.releases;
  }

  protected formatItems(releaseItem: any) {
    const items: BinaryItem[] = [];
    // 200MB
    const maxFileSize = 1024 * 1024 * 200;
    for (const asset of releaseItem.assets) {
      if (asset.size > maxFileSize) continue;
      items.push({
        name: asset.name,
        isDir: false,
        url: asset.browser_download_url,
        size: asset.size,
        date: asset.updated_at,
      });
    }
    // tarball_url and zipball_url
    // https://github.com/electron/electron/archive/v16.0.5.zip
    // https://github.com/electron/electron/archive/v16.0.5.tar.gz
    if (releaseItem.tarball_url) {
      items.push({
        name: `${releaseItem.tag_name}.tar.gz`,
        isDir: false,
        url: `https://github.com/${this.binaryConfig.repo}/archive/${releaseItem.tag_name}.tar.gz`,
        size: '-',
        date: releaseItem.published_at,
      });
    }
    if (releaseItem.zipball_url) {
      items.push({
        name: `${releaseItem.tag_name}.zip`,
        isDir: false,
        url: `https://github.com/${this.binaryConfig.repo}/archive/${releaseItem.tag_name}.zip`,
        size: '-',
        date: releaseItem.published_at,
      });
    }
    return items;
  }

  async fetch(dir: string): Promise<FetchResult | undefined> {
    const releases = await this.initReleases();
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
      }
    } else {
      for (const item of releases) {
        if (dir === `/${item.tag_name}/`) {
          items = this.formatItems(item);
          break;
        }
      }
    }

    return { items };
  }
}
