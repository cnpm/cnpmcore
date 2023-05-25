import { SingletonProto } from '@eggjs/tegg';
import { BinaryType } from '../../enum/Binary';
import { AbstractBinary, FetchResult, BinaryItem, BinaryAdapter } from './AbstractBinary';

@SingletonProto()
@BinaryAdapter(BinaryType.Sqlcipher)
export class SqlcipherBinary extends AbstractBinary {
  async initFetch() {
    // do nothing
    return;
  }

  async fetch(dir: string): Promise<FetchResult | undefined> {
    const dirItems: {
      [key: string]: BinaryItem[];
    } = {
      '/': [],
    };
    const s3Url = 'https://journeyapps-node-binary.s3.amazonaws.com/@journeyapps/sqlcipher';
    const pkgUrl = 'https://registry.npmjs.com/@journeyapps/sqlcipher';
    const data = await this.requestJSON(pkgUrl);
    // https://github.com/journeyapps/node-sqlcipher/blob/master/.circleci/config.yml#L407
    // https://github.com/journeyapps/node-sqlcipher/issues/35#issuecomment-698924173
    // https://journeyapps-node-binary.s3.amazonaws.com/@journeyapps/sqlcipher/v5.3.0/napi-v3-darwin-arm64.tar.gz
    // https://journeyapps-node-binary.s3.amazonaws.com/@journeyapps/sqlcipher/v5.3.0/napi-v6-darwin-arm64.tar.gz
    // https://journeyapps-node-binary.s3.amazonaws.com/@journeyapps/sqlcipher/v5.3.0/napi-v3-darwin-x64.tar.gz
    // https://journeyapps-node-binary.s3.amazonaws.com/@journeyapps/sqlcipher/v5.3.0/napi-v6-darwin-x64.tar.gz

    // https://journeyapps-node-binary.s3.amazonaws.com/@journeyapps/sqlcipher/v5.3.0/napi-v6-linux-x64.tar.gz
    // https://journeyapps-node-binary.s3.amazonaws.com/@journeyapps/sqlcipher/v5.3.0/napi-v3-linux-x64.tar.gz

    // https://journeyapps-node-binary.s3.amazonaws.com/@journeyapps/sqlcipher/v5.3.0/napi-v6-win32-arm64.tar.gz
    // https://journeyapps-node-binary.s3.amazonaws.com/@journeyapps/sqlcipher/v5.3.0/napi-v3-win32-arm64.tar.gz
    // https://journeyapps-node-binary.s3.amazonaws.com/@journeyapps/sqlcipher/v5.3.0/napi-v3-win32-ia32.tar.gz
    // https://journeyapps-node-binary.s3.amazonaws.com/@journeyapps/sqlcipher/v5.3.0/napi-v6-win32-ia32.tar.gz
    // https://journeyapps-node-binary.s3.amazonaws.com/@journeyapps/sqlcipher/v5.3.0/napi-v3-win32-x64.tar.gz
    // https://journeyapps-node-binary.s3.amazonaws.com/@journeyapps/sqlcipher/v5.3.0/napi-v6-win32-x64.tar.gz
    const nodePlatformAndArchs = [
      'linux-x64',
      'darwin-x64',
      'darwin-arm64',
      'win32-x64',
      'win32-arm64',
      'win32-ia32',
    ];
    for (const version in data.versions) {
      const major = parseInt(version.split('.', 1)[0]);
      if (major < 5) continue;
      // >= 5.0.0
      const pkgVersion = data.versions[version];
      const napiVersions = pkgVersion.binary && pkgVersion.binary.napi_versions || [];
      const date = data.time[version];
      dirItems['/'].push({
        name: `v${version}/`,
        date,
        size: '-',
        isDir: true,
        url: '',
      });
      const versionDir = `/v${version}/`;
      dirItems[versionDir] = [];
      for (const nodePlatformAndArch of nodePlatformAndArchs) {
        // napi
        for (const napiVersion of napiVersions) {
          // >= 5.0.0
          // "package_name": "napi-v{napi_build_version}-{platform}-{arch}.tar.gz",
          // "napi_versions": [
          //   3, 6
          // ]
          const name = `napi-v${napiVersion}-${nodePlatformAndArch}.tar.gz`;
          dirItems[versionDir].push({
            name,
            date,
            size: '-',
            isDir: false,
            url: `${s3Url}/v${version}/${name}`,
            ignoreDownloadStatuses: [ 404, 403 ],
          });
        }
      }
    }
    return { items: dirItems[dir] };
  }
}
