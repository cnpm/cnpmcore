import { JSONBuilder } from '@cnpmjs/packument';
import { AccessLevel, Inject, SingletonProto } from 'egg';

import type { NFSAdapter } from '../common/adapter/NFSAdapter.ts';
import type { Dist } from '../core/entity/Dist.ts';
import type { PackageJSONType, PackageRepository } from './PackageRepository.ts';

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
      const [packageVersionJson, readme] = await Promise.all([
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

  async readDistBytesToBuffer(dist: Dist): Promise<Buffer | undefined> {
    const bytes = await this.readDistBytes(dist);
    if (!bytes) return undefined;
    return Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  }

  async readDistBytesToJSONBuilder(dist: Dist): Promise<JSONBuilder | undefined> {
    const bytes = await this.readDistBytesToBuffer(dist);
    if (!bytes) return undefined;
    return new JSONBuilder(bytes);
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
    return await this.nfsAdapter.downloadFile(dist.path, file, 60_000 * 5);
  }
}
