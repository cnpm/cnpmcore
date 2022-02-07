import { AbstractBinary, FetchResult, BinaryItem } from './AbstractBinary';

export class GithubBinary extends AbstractBinary {
  private releases?: any[];

  async fetch(dir: string): Promise<FetchResult | undefined> {
    if (!this.releases) {
      // https://docs.github.com/en/rest/reference/releases get three pages
      // https://api.github.com/repos/electron/electron/releases
      // https://api.github.com/repos/electron/electron/releases?per_page=100&page=3
      let releases: any[] = [];
      for (let i = 0; i < 3; i++) {
        const url = `https://api.github.com/repos/${this.binaryConfig.repo}/releases?per_page=100&page=${i + 1}`;
        const data = await this.requestJSON(url);
        if (!Array.isArray(data)) {
          this.logger.warn('[GithubBinary.fetch:response-data-not-array] data: %j, url: %s', data, url);
          return;
        }
        releases = releases.concat(data);
      }
      this.releases = releases;
    }

    const items: BinaryItem[] = [];
    if (dir === '/') {
      for (const item of this.releases) {
        items.push({
          name: `${item.tag_name}/`,
          isDir: true,
          url: item.url,
          size: '-',
          date: item.published_at,
        });
      }
    } else {
      for (const item of this.releases) {
        if (dir === `/${item.tag_name}/`) {
          // 200MB
          const maxFileSize = 1024 * 1024 * 200;
          for (const asset of item.assets) {
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
          if (item.tarball_url) {
            items.push({
              name: `${item.tag_name}.tar.gz`,
              isDir: false,
              url: `https://github.com/${this.binaryConfig.repo}/archive/${item.tag_name}.tar.gz`,
              size: '-',
              date: item.published_at,
            });
          }
          if (item.zipball_url) {
            items.push({
              name: `${item.tag_name}.zip`,
              isDir: false,
              url: `https://github.com/${this.binaryConfig.repo}/archive/${item.tag_name}.zip`,
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
