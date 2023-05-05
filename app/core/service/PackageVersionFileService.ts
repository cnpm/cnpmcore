import fs from 'node:fs/promises';
import { join, dirname, basename } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import tar from 'tar';
import {
  AccessLevel,
  SingletonProto,
  Inject,
} from '@eggjs/tegg';
import { AbstractService } from '../../common/AbstractService';
import {
  calculateIntegrity,
} from '../../common/PackageUtil';
import { createTempDir, mimeLookup } from '../../common/FileUtil';
import {
  PackageRepository,
} from '../../repository/PackageRepository';
import { PackageVersionFileRepository } from '../../repository/PackageVersionFileRepository';
import { DistRepository } from '../../repository/DistRepository';
import { PackageVersionFile } from '../entity/PackageVersionFile';
import { PackageVersion } from '../entity/PackageVersion';
import { Package } from '../entity/Package';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class PackageVersionFileService extends AbstractService {
  @Inject()
  private readonly packageRepository: PackageRepository;
  @Inject()
  private readonly packageVersionFileRepository: PackageVersionFileRepository;
  @Inject()
  private readonly distRepository: DistRepository;

  async listPackageVersionFiles(pkgVersion: PackageVersion, directory: string) {
    await this.#ensurePackageVersionFilesSync(pkgVersion);
    return await this.packageVersionFileRepository.listPackageVersionFiles(pkgVersion.packageVersionId, directory);
  }

  async showPackageVersionFile(pkgVersion: PackageVersion, path: string) {
    await this.#ensurePackageVersionFilesSync(pkgVersion);
    const { directory, name } = this.#getDirectoryAndName(path);
    return await this.packageVersionFileRepository.findPackageVersionFile(
      pkgVersion.packageVersionId, directory, name);
  }

  async #ensurePackageVersionFilesSync(pkgVersion: PackageVersion) {
    const hasFiles = await this.packageVersionFileRepository.hasPackageVersionFiles(pkgVersion.packageVersionId);
    if (!hasFiles) {
      await this.syncPackageVersionFiles(pkgVersion);
    }
  }

  async syncPackageVersionFiles(pkgVersion: PackageVersion) {
    const files: PackageVersionFile[] = [];
    const tarStream = await this.distRepository.getDistStream(pkgVersion.tarDist);
    if (!tarStream) return files;
    const pkg = await this.packageRepository.findPackageByPackageId(pkgVersion.packageId);
    if (!pkg) return files;
    const dirname = `unpkg_${pkg.fullname.replace('/', '_')}@${pkgVersion.version}_${randomUUID()}`;
    const tmpdir = await createTempDir(this.config.dataDir, dirname);
    const paths: string[] = [];
    try {
      await pipeline(tarStream, tar.extract({
        cwd: tmpdir,
        strip: 1,
        onentry: entry => {
          paths.push(entry.path.replace(/^package\//i, '/'));
        },
      }));
      for (const path of paths) {
        const localFile = join(tmpdir, path);
        const file = await this.#savePackageVersionFile(pkg, pkgVersion, path, localFile);
        files.push(file);
      }
      this.logger.info('[PackageVersionFileService.syncPackageVersionFiles:success] packageVersionId: %s, %d files, tmpdir: %s',
        pkgVersion.packageVersionId, files.length, tmpdir);
      return files;
    } catch (err) {
      this.logger.warn('[PackageVersionFileService.syncPackageVersionFiles:error] packageVersionId: %s, error: %s, tmpdir: %s',
        pkgVersion.packageVersionId, err, tmpdir);
      throw err;
    } finally {
      await fs.rm(tmpdir, { recursive: true, force: true });
    }
  }

  async #savePackageVersionFile(pkg: Package, pkgVersion: PackageVersion, path: string, localFile: string) {
    const { directory, name } = this.#getDirectoryAndName(path);
    let file = await this.packageVersionFileRepository.findPackageVersionFile(
      pkgVersion.packageVersionId, directory, name);
    if (file) return file;
    const stat = await fs.stat(localFile);
    const distIntegrity = await calculateIntegrity(localFile);
    const dist = pkg.createPackageVersionFile(path, pkgVersion.version, {
      size: stat.size,
      shasum: distIntegrity.shasum,
      integrity: distIntegrity.integrity,
    });
    await this.distRepository.saveDist(dist, localFile);
    file = PackageVersionFile.create({
      packageVersionId: pkgVersion.packageVersionId,
      directory,
      name,
      dist,
      contentType: mimeLookup(path),
      mtime: stat.mtime,
    });
    await this.packageVersionFileRepository.createPackageVersionFile(file);
    this.logger.info('[PackageVersionFileService.#savePackageVersionFile:success] fileId: %s, size: %s, path: %s',
      file.packageVersionFileId, dist.size, file.path);
    return file;
  }

  #getDirectoryAndName(path: string) {
    return {
      directory: dirname(path),
      name: basename(path),
    };
  }
}
