import { AccessLevel, SingletonProto, Inject } from '@eggjs/tegg';
import { NFSAdapter } from '../common/adapter/NFSAdapter';
import { PackageJSONType, PackageRepository } from './PackageRepository';
import { Dist } from '../core/entity/Dist';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class DistRepository {
  @Inject()
  private readonly packageRepository: PackageRepository;

  @Inject()
  private readonly nfsAdapter: NFSAdapter;

  async findPackageVersionManifest(packageId: string, version: string): Promise<PackageJSONType | undefined> {
    const packageVersion = await this.packageRepository.findPackageVersion(packageId, version);
    if (packageVersion) {
      const [ packageVersionJson, readme ] = await Promise.all([
        this.readDistBytesToJSON<PackageJSONType>(packageVersion.manifestDist),
        this.readDistBytesToString(packageVersion.readmeDist),
      ]);
      if (packageVersionJson) {
        packageVersionJson.readme = readme;
      }
      return packageVersionJson;
    }
  }

  async findPackageAbbreviatedManifest(packageId: string, version: string): Promise<PackageJSONType | undefined> {
    const packageVersion = await this.packageRepository.findPackageVersion(packageId, version);
    if (packageVersion) {
      return await this.readDistBytesToJSON(packageVersion.abbreviatedDist);
    }
  }

  async readDistBytesToJSON<T>(dist: Dist) {
    const str = await this.readDistBytesToString(dist);
    if (str) {
      return JSON.parse(str) as T;
    }
  }

  async readDistBytesToString(dist: Dist): Promise<string> {
    const bytes = await this.readDistBytes(dist);
    if (!bytes) return '';
    return Buffer.from(bytes).toString('utf8');
  }

  async readDistBytes(dist: Dist): Promise<Uint8Array | undefined> {
    return await this.nfsAdapter.getBytes(dist.path);
  }

  async getDistStream(dist: Dist) {
    return await this.nfsAdapter.getStream(dist.path);
  }

  async saveDist(dist: Dist, buf: Uint8Array | string) {
    if (typeof buf === 'string') {
      return await this.nfsAdapter.uploadFile(dist.path, buf);
    }
    return await this.nfsAdapter.uploadBytes(dist.path, buf);
  }

  async destroyDist(dist: Dist) {
    return await this.nfsAdapter.remove(dist.path);
  }

  async downloadDist(dist: Dist) {
    return await this.nfsAdapter.getDownloadUrlOrStream(dist.path);
  }

  async downloadDistToFile(dist: Dist, file: string) {
    // max up to 5mins
    return await this.nfsAdapter.downloadFile(dist.path, file, 60000 * 5);
  }
}
