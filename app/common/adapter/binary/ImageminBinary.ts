import { SingletonProto } from '@eggjs/tegg';
import { BinaryType } from '../../enum/Binary';
import binaries, { BinaryName } from '../../../../config/binaries';
import { AbstractBinary, FetchResult, BinaryItem, BinaryAdapter } from './AbstractBinary';

@SingletonProto()
@BinaryAdapter(BinaryType.Imagemin)
export class ImageminBinary extends AbstractBinary {
  async initFetch() {
    // do nothing
    return;
  }

  async fetch(dir: string, binaryName: BinaryName): Promise<FetchResult | undefined> {
    const binaryConfig = binaries[binaryName];
    const dirItems: {
      [key: string]: BinaryItem[];
    } = {};
    const npmPackageName = binaryConfig.options?.npmPackageName ?? binaryName;
    const pkgUrl = `https://registry.npmjs.com/${npmPackageName}`;
    const data = await this.requestJSON(pkgUrl);
    dirItems['/'] = [];
    // mini version 4.0.0
    // https://github.com/imagemin/jpegtran-bin/blob/v4.0.0/lib/index.js
    // https://github.com/imagemin/pngquant-bin/blob/v4.0.0/lib/index.js
    for (const version in data.versions) {
      const major = parseInt(version.split('.', 1)[0]);
      if (major < 4) continue;
      // >= 4.0.0
      const date = data.time[version];
      // https://raw.githubusercontent.com/imagemin/jpegtran-bin/v${pkg.version}/vendor/`
      dirItems['/'].push({
        name: `v${version}/`,
        date,
        size: '-',
        isDir: true,
        url: '',
      });
      const versionDir = `/v${version}/`;
      dirItems[versionDir] = [];
      dirItems[versionDir].push({
        name: 'vendor/',
        date,
        size: '-',
        isDir: true,
        url: '',
      });
      const versionVendorDir = `/v${version}/vendor/`;
      dirItems[versionVendorDir] = [];
      for (const platform of binaryConfig.options!.nodePlatforms!) {
        dirItems[versionVendorDir].push({
          name: `${platform}/`,
          date,
          size: '-',
          isDir: true,
          url: '',
        });
        const platformDir = `/v${version}/vendor/${platform}/`;
        dirItems[platformDir] = [];
        const archs = binaryConfig.options!.nodeArchs![platform];
        if (archs.length === 0) {
          for (const name of binaryConfig.options!.binFiles![platform]) {
            dirItems[platformDir].push({
              name,
              date,
              size: '-',
              isDir: false,
              url: `${binaryConfig.distUrl}/${binaryConfig.repo}${platformDir}${name}`,
              ignoreDownloadStatuses: [ 404 ],
            });
          }
        } else {
          for (const arch of archs) {
            dirItems[platformDir].push({
              name: `${arch}/`,
              date,
              size: '-',
              isDir: true,
              url: '',
            });
            const platformArchDir = `/v${version}/vendor/${platform}/${arch}/`;
            dirItems[platformArchDir] = [];

            for (const name of binaryConfig.options!.binFiles![platform]) {
              dirItems[platformArchDir].push({
                name,
                date,
                size: '-',
                isDir: false,
                url: `${binaryConfig.distUrl}/${binaryConfig.repo}${platformArchDir}${name}`,
                ignoreDownloadStatuses: [ 404 ],
              });
            }
          }
        }
      }
    }
    return { items: dirItems[dir] };
  }
}
