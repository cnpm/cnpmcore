import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
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
    const tarFile = `${tmpdir}.tgz`;
    const paths: string[] = [];
    try {
      await pipeline(tarStream, createWriteStream(tarFile));
      await tar.extract({
        file: tarFile,
        cwd: tmpdir,
        strip: 1,
        onentry: entry => {
          paths.push(entry.path.replace(/^package\//i, '/'));
        },
      });
      for (const path of paths) {
        const localFile = join(tmpdir, path);
        const file = await this.#savePackageVersionFile(pkg, pkgVersion, path, localFile);
        files.push(file);
      }
      this.logger.info('[PackageVersionFileService.syncPackageVersionFiles:success] packageVersionId: %s, %d paths, %d files, tmpdir: %s',
        pkgVersion.packageVersionId, paths.length, files.length, tmpdir);
      return files;
    } catch (err) {
      this.logger.warn('[PackageVersionFileService.syncPackageVersionFiles:error] packageVersionId: %s, %d paths, tmpdir: %s, error: %s',
        pkgVersion.packageVersionId, paths.length, tmpdir, err);
      // ignore TAR_BAD_ARCHIVE error
      if (err.code === 'TAR_BAD_ARCHIVE') return files;
      throw err;
    } finally {
      try {
        await fs.rm(tarFile, { force: true });
        await fs.rm(tmpdir, { recursive: true, force: true });
      } catch (err) {
        this.logger.warn('[PackageVersionFileService.syncPackageVersionFiles:warn] remove tmpdir: %s, error: %s',
          tmpdir, err);
      }
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
    try {
      await this.packageVersionFileRepository.createPackageVersionFile(file);
      this.logger.info('[PackageVersionFileService.#savePackageVersionFile:success] fileId: %s, size: %s, path: %s',
        file.packageVersionFileId, dist.size, file.path);
    } catch (err) {
      // ignore Duplicate entry
      if (err.code === 'ER_DUP_ENTRY') return file;
      throw err;
    }
    return file;
  }

  #getDirectoryAndName(path: string) {
    return {
      directory: dirname(path),
      name: basename(path),
    };
  }
}
