import { SingletonProto } from '@eggjs/tegg';
import { BinaryType } from '../../enum/Binary';
import binaries, { BinaryName, BinaryTaskConfig } from '../../../../config/binaries';
import { AbstractBinary, FetchResult, BinaryItem, BinaryAdapter } from './AbstractBinary';

@SingletonProto()
@BinaryAdapter(BinaryType.GitHub)
export class GithubBinary extends AbstractBinary {
  private releases: Record<string, any[]> = {};

  async initFetch(binaryName: BinaryName) {
    delete this.releases[binaryName];
  }

  protected async initReleases(binaryName: BinaryName, binaryConfig: BinaryTaskConfig) {
    if (!this.releases[binaryName]) {
      // https://docs.github.com/en/rest/reference/releases get three pages
      // https://api.github.com/repos/electron/electron/releases
      // https://api.github.com/repos/electron/electron/releases?per_page=100&page=3
      let releases: any[] = [];
      const maxPage = binaryConfig.options?.maxPage || 1;
      for (let i = 0; i < maxPage; i++) {
        const url = `https://api.github.com/repos/${binaryConfig.repo}/releases?per_page=100&page=${i + 1}`;
        const requestHeaders: Record<string, string> = {};
        if (process.env.GITHUB_TOKEN) {
          requestHeaders.Authorization = `token ${process.env.GITHUB_TOKEN}`;
        }
        const data = await this.requestJSON(url, requestHeaders);
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
      this.releases[binaryName] = releases;
    }
    return this.releases[binaryName];
  }

  protected formatItems(releaseItem: any, binaryConfig: BinaryTaskConfig) {
    const items: BinaryItem[] = [];
    // 250MB
    const maxFileSize = 1024 * 1024 * 250;
    for (const asset of releaseItem.assets) {
      if (asset.size > maxFileSize) {
        this.logger.info('[GithubBinary.formatItems] asset reach max file size(> 250MB), ignore download it, asset: %j', asset);
        continue;
      }
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
        url: `https://github.com/${binaryConfig.repo}/archive/${releaseItem.tag_name}.tar.gz`,
        size: '-',
        date: releaseItem.published_at,
      });
    }
    if (releaseItem.zipball_url) {
      items.push({
        name: `${releaseItem.tag_name}.zip`,
        isDir: false,
        url: `https://github.com/${binaryConfig.repo}/archive/${releaseItem.tag_name}.zip`,
        size: '-',
        date: releaseItem.published_at,
      });
    }
    return items;
  }

  async fetch(dir: string, binaryName: BinaryName): Promise<FetchResult | undefined> {
    const binaryConfig = binaries[binaryName];
    const releases = await this.initReleases(binaryName, binaryConfig);
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
          items = this.formatItems(item, binaryConfig);
          break;
        }
      }
    }

    return { items };
  }
}
