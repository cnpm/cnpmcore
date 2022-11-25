import { join } from 'path';
import { AbstractBinary, FetchResult, BinaryItem } from './AbstractBinary';

export class NodePreGypBinary extends AbstractBinary {
  private dirItems: {
    [key: string]: BinaryItem[];
  };

  // https://github.com/mapbox/node-pre-gyp
  async fetch(dir: string): Promise<FetchResult | undefined> {
    if (!this.dirItems) {
      this.dirItems = {};
      const pkgUrl = `https://registry.npmjs.com/${this.binaryName}`;
      const data = await this.requestJSON(pkgUrl);
      this.dirItems = {};
      this.dirItems['/'] = [];
      const nodeABIVersions = await this.listNodeABIVersions();
      const nodePlatforms = this.listNodePlatforms();
      const nodeArchs = this.listNodeArchs();
      const nodeLibcs = this.listNodeLibcs();
      for (const version in data.versions) {
        const date = data.time[version];
        const pkgVersion = data.versions[version];
        if (!pkgVersion.binary) continue;
        // https://github.com/mapbox/node-pre-gyp#package_name
        // defaults to {module_name}-v{version}-{node_abi}-{platform}-{arch}.tar.gz
        let binaryFile = pkgVersion.binary.package_name
          || '{module_name}-v{version}-{node_abi}-{platform}-{arch}.tar.gz';
        if (!binaryFile) continue;
        const moduleName = pkgVersion.binary.module_name || pkgVersion.name;
        binaryFile = binaryFile.replace('{version}', version)
          .replace('{module_name}', moduleName);

        let currentDir = this.dirItems['/'];
        let versionPrefix = '';
        let remotePath = pkgVersion.binary.remote_path;
        const napiVersions = pkgVersion.binary.napi_versions ?? [];
        if (this.binaryConfig.options?.requiredNapiVersions && napiVersions.length === 0) continue;
        if (remotePath?.includes('{version}')) {
          const dirName = remotePath.includes('v{version}') ? `v${version}` : version;
          versionPrefix = `/${dirName}`;
          this.dirItems['/'].push({
            name: `${dirName}/`,
            date,
            size: '-',
            isDir: true,
            url: '',
          });
          currentDir = this.dirItems[`/${dirName}/`] = [];
        }

        // https://node-precompiled-binaries.grpc.io/?delimiter=/&prefix=grpc/v1.24.11/
        // https://github.com/grpc/grpc-node/blob/grpc%401.24.x/packages/grpc-native-core/package.json#L50
        // "binary": {
        //   "module_name": "grpc_node",
        //   "module_path": "src/node/extension_binary/{node_abi}-{platform}-{arch}-{libc}",
        //   "host": "https://node-precompiled-binaries.grpc.io/",
        //   "remote_path": "{name}/v{version}",
        //   "package_name": "{node_abi}-{platform}-{arch}-{libc}.tar.gz"
        // },
        if (binaryFile.includes('{node_abi}')
            && binaryFile.includes('{platform}')
            && binaryFile.includes('{arch}')
            && binaryFile.includes('{libc}')) {
          for (const nodeAbi of nodeABIVersions) {
            for (const platform of nodePlatforms) {
              const archs = nodeArchs[platform];
              const libcs = nodeLibcs[platform];
              for (const arch of archs) {
                for (const libc of libcs) {
                  const name = binaryFile.replace('{node_abi}', `node-v${nodeAbi}`)
                    .replace('{platform}', platform)
                    .replace('{arch}', arch)
                    .replace('{libc}', libc);
                  currentDir.push({
                    name,
                    date,
                    size: '-',
                    isDir: false,
                    url: `${this.binaryConfig.distUrl}/${this.binaryName}${versionPrefix}/${name}`,
                    ignoreDownloadStatuses: [ 404 ],
                  });
                }
              }
            }
          }
        } else if (binaryFile.includes('{node_abi}')
            && binaryFile.includes('{platform}')
            && binaryFile.includes('{arch}')) {
          for (const nodeAbi of nodeABIVersions) {
            for (const platform of nodePlatforms) {
              const archs = nodeArchs[platform];
              for (const arch of archs) {
                const name = binaryFile.replace('{node_abi}', `node-v${nodeAbi}`)
                  .replace('{platform}', platform)
                  .replace('{arch}', arch);
                currentDir.push({
                  name,
                  date,
                  size: '-',
                  isDir: false,
                  url: `${this.binaryConfig.distUrl}/${this.binaryName}${versionPrefix}/${name}`,
                  ignoreDownloadStatuses: [ 404 ],
                });
              }
            }
          }
        } else if (binaryFile.includes('{platform}-{arch}-{node_napi_label}-{libc}') && napiVersions.length > 0) {
          // https://skia-canvas.s3.us-east-1.amazonaws.com/v0.9.30/darwin-arm64-napi-v6-unknown.tar.gz
          // https://github.com/samizdatco/skia-canvas/blob/2a75801d7cce3b4e4e6ad015a173daefaa8465e6/package.json#L48
          // "binary": {
          //   "module_name": "index",
          //   "module_path": "./lib/v{napi_build_version}",
          //   "remote_path": "./v{version}",
          //   "package_name": "{platform}-{arch}-{node_napi_label}-{libc}.tar.gz",
          //   "host": "https://skia-canvas.s3.us-east-1.amazonaws.com",
          //   "napi_versions": [
          //     6
          //   ]
          // },
          for (const platform of nodePlatforms) {
            const archs = nodeArchs[platform];
            const libcs = nodeLibcs[platform];
            for (const arch of archs) {
              for (const libc of libcs) {
                for (const napiVersion of napiVersions) {
                  const name = binaryFile.replace('{platform}', platform)
                    .replace('{arch}', arch)
                    .replace('{node_napi_label}', `napi-v${napiVersion}`)
                    .replace('{libc}', libc);
                  currentDir.push({
                    name,
                    date,
                    size: '-',
                    isDir: false,
                    url: `${this.binaryConfig.distUrl}${versionPrefix}/${name}`,
                    ignoreDownloadStatuses: [ 404, 403 ],
                  });
                }
              }
            }
          }
        } else if (binaryFile.includes('{platform}') && binaryFile.includes('{arch}')) {
          // https://github.com/grpc/grpc-node/blob/master/packages/grpc-tools/package.json#L29
          // "binary": {
          //   "module_name": "grpc_tools",
          //   "host": "https://node-precompiled-binaries.grpc.io/",
          //   "remote_path": "{name}/v{version}",
          //   "package_name": "{platform}-{arch}.tar.gz",
          //   "module_path": "bin"
          // },
          // handle {configuration}
          // "binary": {
          //   "module_name": "wrtc",
          //   "module_path": "./build/{configuration}/",
          //   "remote_path": "./{module_name}/v{version}/{configuration}/",
          //   "package_name": "{platform}-{arch}.tar.gz",
          //   "host": "https://node-webrtc.s3.amazonaws.com"
          // },
          for (const platform of nodePlatforms) {
            const archs = nodeArchs[platform];
            for (const arch of archs) {
              const binaryFileName = binaryFile.replace('{platform}', platform)
                .replace('{arch}', arch);
              remotePath = remotePath.replace('{module_name}', moduleName)
                .replace('{name}', this.binaryName)
                .replace('{version}', version)
                .replace('{configuration}', 'Release');
              const binaryFilePath = join('/', remotePath, binaryFileName);
              const remoteUrl = `${this.binaryConfig.distUrl}${binaryFilePath}`;
              currentDir.push({
                name: binaryFileName,
                date,
                size: '-',
                isDir: false,
                url: remoteUrl,
                ignoreDownloadStatuses: [ 404 ],
              });
            }
          }
        }
      }
    }
    return { items: this.dirItems[dir] };
  }
}
