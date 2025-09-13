import { AccessLevel, Inject, SingletonProto } from '@eggjs/tegg';
import type { Readable } from 'node:stream';

import type { NFSAdapter } from '../common/adapter/NFSAdapter.js';
import type {
  PackageJSONType,
  PackageRepository,
} from './PackageRepository.js';
import type { Dist } from '../core/entity/Dist.js';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class DistRepository {
  @Inject()
  private readonly packageRepository: PackageRepository;

  @Inject()
  private readonly nfsAdapter: NFSAdapter;

  async findPackageVersionManifest(
    packageId: string,
    version: string
  ): Promise<PackageJSONType | undefined> {
    const packageVersion = await this.packageRepository.findPackageVersion(
      packageId,
      version
    );
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

  async findPackageAbbreviatedManifest(
    packageId: string,
    version: string
  ): Promise<PackageJSONType | undefined> {
    const packageVersion = await this.packageRepository.findPackageVersion(
      packageId,
      version
    );
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
    // Use stream-based approach to reduce memory usage
    const stream = await this.nfsAdapter.getStream(dist.path);
    if (!stream) return '';
    
    return this.streamToString(stream);
  }

  /**
   * Private utility to convert a readable stream to string efficiently
   * This reduces memory usage compared to loading entire file as bytes first
   */
  private async streamToString(stream: Readable): Promise<string> {
    const chunks: Buffer[] = [];
    
    // Use async iterator to avoid explicit Promise constructor
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    
    // Concatenate all chunks efficiently
    const result = Buffer.concat(chunks);
    return result.toString('utf8');
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
    return await this.nfsAdapter.downloadFile(dist.path, file, 60_000 * 5);
  }
}
