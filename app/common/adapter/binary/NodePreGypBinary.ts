import { AbstractBinary, FetchResult, BinaryItem } from './AbstractBinary';

export class NodePreGypBinary extends AbstractBinary {
  private dirItems: {
    [key: string]: BinaryItem[];
  };

  // https://github.com/mapbox/node-pre-gyp
  async fetch(dir: string): Promise<FetchResult | undefined> {
    if (!this.dirItems) {
      this.dirItems = {};
      const pkgUrl = `https://registry.npmjs.com/${this.binaryConfig.category}`;
      const data = await this.requestJSON(pkgUrl);
      this.dirItems = {};
      this.dirItems['/'] = [];
      const nodeABIVersions = await this.listNodeABIVersions();
      const nodePlatforms = this.listNodePlatforms();
      const nodeArchs = this.listNodeArchs();
      const nodeLibcs = this.listNodeLibcs();
      for (const version in data.versions) {
        const pkgVersion = data.versions[version];
        const binaryFile = pkgVersion.binary?.package_name;
        if (!binaryFile) continue;

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
                  this.dirItems[versionDir].push({
                    name,
                    date,
                    size: '-',
                    isDir: false,
                    url: `${this.binaryConfig.distUrl}/${this.binaryConfig.category}/v${version}/${name}`,
                    ignoreDownloadStatuses: [ 404 ],
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
          for (const platform of nodePlatforms) {
            const archs = nodeArchs[platform];
            for (const arch of archs) {
              const name = binaryFile.replace('{platform}', platform)
                .replace('{arch}', arch);
              this.dirItems[versionDir].push({
                name,
                date,
                size: '-',
                isDir: false,
                url: `${this.binaryConfig.distUrl}/${this.binaryConfig.category}/v${version}/${name}`,
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
