import { AbstractBinary, FetchResult, BinaryItem } from './AbstractBinary';

export class Sqlite3Binary extends AbstractBinary {
  private dirItems: {
    [key: string]: BinaryItem[];
  };

  async fetch(dir: string): Promise<FetchResult | undefined> {
    if (!this.dirItems) {
      this.dirItems = {};
      const s3Url = 'https://mapbox-node-binary.s3.amazonaws.com';
      const pkgUrl = 'https://registry.npmjs.com/sqlite3';
      const data = await this.requestJSON(pkgUrl);
      this.dirItems = {};
      this.dirItems['/'] = [];
      const nodePlatforms = [
        'linux',
        'darwin',
        'win32',
      ];
      const nodeABIVersions = await this.listNodeABIVersions();
      for (const version in data.versions) {
        const pkgVersion = data.versions[version];
        const napiVersions = pkgVersion.binary && pkgVersion.binary.napi_versions || [];
        const date = data.time[version];
        this.dirItems['/'].push({
          name: `v${version}/`,
          date,
          size: '-',
          isDir: true,
          url: '',
        });
        const versionDir = `/v${version}/`;
        this.dirItems[versionDir] = [];
        const major = parseInt(version.split('.', 1)[0]);
        for (const nodePlatform of nodePlatforms) {
          if (major < 5) {
            // abi
            for (const nodeABIVersion of nodeABIVersions) {
              const name = `node-v${nodeABIVersion}-${nodePlatform}-x64.tar.gz`;
              // https://npmmirror.com/mirrors/sqlite3/v2.2.6/
              this.dirItems[versionDir].push({
                name,
                date,
                size: '-',
                isDir: false,
                // https://mapbox-node-binary.s3.amazonaws.com/sqlite3/v2.2.6/node-v11-darwin-x64.tar.gz
                url: `${s3Url}/sqlite3/v${version}/${name}`,
                ignoreDownloadStatuses: [ 404, 403 ],
              });
            }
            continue;
          }
          // >= 5.0.0
          // napi
          for (const napiVersion of napiVersions) {
            // >= 5.0.0
            // "package_name": "napi-v{napi_build_version}-{platform}-{arch}.tar.gz",
            // https://oss.npmmirror.com/dist/sqlite3/v5.0.0/napi-v3-linux-x64.tar.gz
            // https://github.com/mapbox/node-sqlite3/blob/29debf3ad7d052427541503d871d6c69ed8588a7/package.json#L16
            // "napi_versions": [
            //   3
            // ]
            const name = `napi-v${napiVersion}-${nodePlatform}-x64.tar.gz`;
            this.dirItems[versionDir].push({
              name,
              date,
              size: '-',
              isDir: false,
              // https://mapbox-node-binary.s3.amazonaws.com/sqlite3/v5.0.0/napi-v3-linux-x64.tar.gz
              url: `${s3Url}/sqlite3/v${version}/${name}`,
              ignoreDownloadStatuses: [ 404, 403 ],
            });
          }
        }
      }
    }
    return { items: this.dirItems[dir] };
  }
}
