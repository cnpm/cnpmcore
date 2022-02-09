import { AbstractBinary, FetchResult, BinaryItem } from './AbstractBinary';

export class ImageminBinary extends AbstractBinary {
  private dirItems: {
    [key: string]: BinaryItem[];
  };

  async fetch(dir: string): Promise<FetchResult | undefined> {
    if (!this.dirItems) {
      this.dirItems = {};
      const npmPackageName = this.binaryConfig.options?.npmPackageName ?? this.binaryConfig.category;
      const pkgUrl = `https://registry.npmjs.com/${npmPackageName}`;
      const data = await this.requestJSON(pkgUrl);
      this.dirItems = {};
      this.dirItems['/'] = [];
      // mini version 4.0.0
      // https://github.com/imagemin/jpegtran-bin/blob/v4.0.0/lib/index.js
      // https://github.com/imagemin/pngquant-bin/blob/v4.0.0/lib/index.js
      for (const version in data.versions) {
        const major = parseInt(version.split('.', 1)[0]);
        if (major < 4) continue;
        // >= 4.0.0
        const date = data.time[version];
        // https://raw.githubusercontent.com/imagemin/jpegtran-bin/v${pkg.version}/vendor/`
        this.dirItems['/'].push({
          name: `v${version}/`,
          date,
          size: '-',
          isDir: true,
          url: '',
        });
        const versionDir = `/v${version}/`;
        this.dirItems[versionDir] = [];
        this.dirItems[versionDir].push({
          name: 'vendor/',
          date,
          size: '-',
          isDir: true,
          url: '',
        });
        const versionVendorDir = `/v${version}/vendor/`;
        this.dirItems[versionVendorDir] = [];
        for (const platform of this.binaryConfig.options!.nodePlatforms!) {
          this.dirItems[versionVendorDir].push({
            name: `${platform}/`,
            date,
            size: '-',
            isDir: true,
            url: '',
          });
          const platformDir = `/v${version}/vendor/${platform}/`;
          this.dirItems[platformDir] = [];
          const archs = this.binaryConfig.options!.nodeArchs![platform];
          if (archs.length === 0) {
            for (const name of this.binaryConfig.options!.binFiles![platform]) {
              this.dirItems[platformDir].push({
                name,
                date,
                size: '-',
                isDir: false,
                url: `${this.binaryConfig.distUrl}/${this.binaryConfig.repo}${platformDir}${name}`,
                ignoreDownloadStatuses: [ 404 ],
              });
            }
          } else {
            for (const arch of archs) {
              this.dirItems[platformDir].push({
                name: `${arch}/`,
                date,
                size: '-',
                isDir: true,
                url: '',
              });
              const platformArchDir = `/v${version}/vendor/${platform}/${arch}/`;
              this.dirItems[platformArchDir] = [];

              for (const name of this.binaryConfig.options!.binFiles![platform]) {
                this.dirItems[platformArchDir].push({
                  name,
                  date,
                  size: '-',
                  isDir: false,
                  url: `${this.binaryConfig.distUrl}/${this.binaryConfig.repo}${platformArchDir}${name}`,
                  ignoreDownloadStatuses: [ 404 ],
                });
              }
            }
          }
        }
      }
    }
    return { items: this.dirItems[dir] };
  }
}
