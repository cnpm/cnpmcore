import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  HTTPQuery,
  Inject,
  Context,
  EggContext,
} from '@eggjs/tegg';
import { NotFoundError } from 'egg-errors';
import semver from 'semver';
import { AbstractController } from '../AbstractController';
import { getScopeAndName, FULLNAME_REG_STRING } from '../../../common/PackageUtil';
import { PackageVersionFileService } from '../../../core/service/PackageVersionFileService';
import { PackageManagerService } from '../../../core/service/PackageManagerService';
import { PackageVersionFile } from '../../../core/entity/PackageVersionFile';
import { DistRepository } from '../../../repository/DistRepository';

type FileItem = {
  path: string,
  type: 'file',
  contentType: string,
  integrity: string;
  lastModified: Date,
  size: number,
};

type DirectoryItem = {
  path: string,
  type: 'directory',
  files: (DirectoryItem | FileItem)[],
};

function formatFileItem(file: PackageVersionFile): FileItem {
  return {
    path: file.path,
    type: 'file',
    contentType: file.contentType,
    integrity: file.dist.integrity,
    lastModified: file.mtime,
    size: file.dist.size,
  };
}

const META_CACHE_CONTROL = 'public, s-maxage=600, max-age=60';
const FILE_CACHE_CONTROL = 'public, max-age=31536000';

@HTTPController()
export class ShowPackageVersionFileController extends AbstractController {
  @Inject()
  private packageManagerService: PackageManagerService;
  @Inject()
  private packageVersionFileService: PackageVersionFileService;
  @Inject()
  private distRepository: DistRepository;

  #requireUnpkgEnable() {
    if (!this.config.cnpmcore.enableUnpkg) {
      throw new NotFoundError();
    }
  }

  @HTTPMethod({
    // GET /:fullname/:versionOrTag/files
    path: `/:fullname(${FULLNAME_REG_STRING})/:versionOrTag/files`,
    method: HTTPMethodEnum.GET,
  })
  async listFiles(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPParam() versionOrTag: string) {
    this.#requireUnpkgEnable();
    ctx.vary(this.config.cnpmcore.cdnVaryHeader);
    const [ scope, name ] = getScopeAndName(fullname);
    if (!semver.valid(versionOrTag)) {
      const pkgVersion = await this.packageManagerService.showPackageVersionByTag(scope, name, versionOrTag);
      if (!pkgVersion) {
        throw new NotFoundError(`${fullname}@${versionOrTag} not found`);
      }
      ctx.set('cache-control', META_CACHE_CONTROL);
      ctx.redirect(`/${fullname}/${pkgVersion.version}/files`);
      return;
    }
    const files = await this.#listFilesByDirectory(scope, name, versionOrTag, '/');
    if (!files) {
      throw new NotFoundError(`${fullname}@${versionOrTag}/files not found`);
    }
    ctx.set('cache-control', META_CACHE_CONTROL);
    return files;
  }

  @HTTPMethod({
    // GET /:fullname/:versionOrTag/files/:path
    path: `/:fullname(${FULLNAME_REG_STRING})/:versionOrTag/files/:path(.+)`,
    method: HTTPMethodEnum.GET,
  })
  async raw(@Context() ctx: EggContext,
      @HTTPParam() fullname: string,
      @HTTPParam() versionOrTag: string,
      @HTTPParam() path: string,
      @HTTPQuery() meta: string) {
    this.#requireUnpkgEnable();
    ctx.vary(this.config.cnpmcore.cdnVaryHeader);
    const [ scope, name ] = getScopeAndName(fullname);
    path = `/${path}`;
    const hasMeta = typeof meta === 'string';
    if (!semver.valid(versionOrTag)) {
      const pkgVersion = await this.packageManagerService.showPackageVersionByTag(scope, name, versionOrTag);
      if (!pkgVersion) {
        throw new NotFoundError(`${fullname}@${versionOrTag}${path} not found`);
      }
      ctx.set('cache-control', META_CACHE_CONTROL);
      ctx.redirect(`/${fullname}/${pkgVersion.version}/files${path}` + (hasMeta ? '?meta' : ''));
      return;
    }
    if (path.endsWith('/')) {
      const directory = path.substring(0, path.length - 1);
      const files = await this.#listFilesByDirectory(scope, name, versionOrTag, directory);
      if (!files) {
        throw new NotFoundError(`${fullname}@${versionOrTag}/files${directory} not found`);
      }
      ctx.set('cache-control', META_CACHE_CONTROL);
      return files;
    }

    const file = await this.packageVersionFileService.showPackageVersionFile(scope, name, versionOrTag, path);
    if (!file) {
      throw new NotFoundError(`File ${fullname}@${versionOrTag}${path} not found`);
    }
    if (hasMeta) {
      ctx.set('cache-control', META_CACHE_CONTROL);
      return formatFileItem(file);
    }
    ctx.set('cache-control', FILE_CACHE_CONTROL);
    ctx.type = file.contentType;
    if (file.contentType === 'text/html' || file.contentType === 'text/xml') {
      ctx.attachment(file.path);
    }
    return await this.distRepository.getDistStream(file.dist);
  }

  async #listFilesByDirectory(scope: string, name: string, versionOrTag: string, directory: string) {
    const files = await this.packageVersionFileService.listPackageVersionFiles(scope, name, versionOrTag, directory);
    if (!files || files.length === 0) return null;
    // convert files to directory and file
    const directories = new Map<string, DirectoryItem>();
    for (const file of files) {
      // make sure parent directories exists
      const splits = file.directory.split('/');
      for (const [ index, name ] of splits.entries()) {
        const parentPath = index === 0 ? '' : `/${splits.slice(1, index).join('/')}`;
        const directoryPath = parentPath !== '/' ? `${parentPath}/${name}` : `/${name}`;
        let directoryItem = directories.get(directoryPath);
        if (!directoryItem) {
          directoryItem = {
            path: directoryPath,
            type: 'directory',
            files: [],
          };
          directories.set(directoryPath, directoryItem);
          if (parentPath) {
            // only set the first time
            directories.get(parentPath!)!.files.push(directoryItem);
          }
        }
      }
      directories.get(file.directory)!.files.push(formatFileItem(file));
    }
    return directories.get(directory);
  }
}
