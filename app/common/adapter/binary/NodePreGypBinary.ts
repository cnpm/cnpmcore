import { SingletonProto } from '@eggjs/tegg';
import { BinaryType } from '../../enum/Binary';
import binaries, { BinaryName } from '../../../../config/binaries';
import { AbstractBinary, FetchResult, BinaryItem, BinaryAdapter } from './AbstractBinary';
import * as versioning from '@mapbox/node-pre-gyp/lib/util/versioning';

@SingletonProto()
@BinaryAdapter(BinaryType.NodePreGyp)
export class NodePreGypBinary extends AbstractBinary {
  async initFetch() {
    // do nothing
    return;
  }

  // https://github.com/mapbox/node-pre-gyp
  async fetch(dir: string, binaryName: BinaryName): Promise<FetchResult | undefined> {
    const binaryConfig = binaries[binaryName];
    const pkgUrl = `https://registry.npmjs.com/${binaryName}`;
    const data = await this.requestJSON(pkgUrl);
    const dirItems: {
      [key: string]: BinaryItem[];
    } = {
      '/': [],
    };
    const targetVersions = await this.listTargetVersions();
    const nodePlatforms = this.listNodePlatforms();
    const nodeArchs = this.listNodeArchs(binaryConfig);
    const nodeLibcs = this.listNodeLibcs();
    const runtimes = [ 'node' ]; // 'node-webkit','electron'
    for (const version in data.versions) {
      const date = data.time[version];
      const pkgVersion = data.versions[version];
      if (!pkgVersion.binary) continue;
      const napiVersions = pkgVersion.binary.napi_versions ?? [];
      if (binaryConfig.options?.requiredNapiVersions && napiVersions.length === 0) continue;
      const remotePath = pkgVersion.binary.remote_path;
      for (const target of targetVersions) {
        for (const platform of nodePlatforms) {
          const archs = nodeArchs[platform];
          const libcs = nodeLibcs[platform];
          for (const arch of archs) {
            for (const libc of libcs) {
              for (const runtime of runtimes) {
                const { package_name, hosted_tarball } = versioning.evaluate(pkgVersion, {
                  target_platform: platform,
                  runtime,
                  target,
                  target_arch: arch,
                  target_libc: libc,
                });
                dirItems['/'].push({
                  name: package_name,
                  date,
                  size: '-',
                  isDir: !!remotePath?.includes('{version}'),
                  url: hosted_tarball,
                  ignoreDownloadStatuses: [ 404 ],
                });
                if (napiVersions.length > 0) {
                  // if napi_versions , evaluate with napi_build_version
                  for (const napiVersion of napiVersions) {
                    const { package_name, hosted_tarball } = versioning.evaluate(pkgVersion, {
                      target_platform: platform,
                      runtime,
                      target,
                      target_arch: arch,
                      target_libc: libc,
                    }, napiVersion);
                    dirItems['/'].push({
                      name: package_name,
                      date,
                      size: '-',
                      isDir: !!remotePath?.includes('{version}'),
                      url: hosted_tarball,
                      ignoreDownloadStatuses: [ 404 ],
                    });
                  }
                }
              }
            }
          }
        }
      }
    }
    return { items: dirItems[dir] };
  }
}
