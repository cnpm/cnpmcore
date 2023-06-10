import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  HTTPQuery,
  Inject,
  Context,
  EggContext,
  Middleware,
} from '@eggjs/tegg';
import { NotFoundError } from 'egg-errors';
import { join } from 'node:path';
import { AbstractController } from './AbstractController';
import { AdminAccess } from '../middleware/AdminAccess';
import { getScopeAndName, FULLNAME_REG_STRING } from '../../common/PackageUtil';
import { PackageVersionFileService } from '../../core/service/PackageVersionFileService';
import { PackageManagerService } from '../../core/service/PackageManagerService';
import { PackageVersionFile } from '../../core/entity/PackageVersionFile';
import { PackageVersion } from '../../core/entity/PackageVersion';
import { DistRepository } from '../../repository/DistRepository';
import { Spec } from '../typebox';

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
export class PackageVersionFileController extends AbstractController {
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
    // PUT /:fullname/:versionSpec/files
    path: `/:fullname(${FULLNAME_REG_STRING})/:versionSpec/files`,
    method: HTTPMethodEnum.PUT,
  })
  @Middleware(AdminAccess)
  async sync(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPParam() versionSpec: string) {
    ctx.tValidate(Spec, `${fullname}@${versionSpec}`);
    this.#requireUnpkgEnable();
    const [ scope, name ] = getScopeAndName(fullname);
    const { packageVersion } = await this.packageManagerService.showPackageVersionByVersionOrTag(
      scope, name, versionSpec);
    if (!packageVersion) {
      throw new NotFoundError(`${fullname}@${versionSpec} not found`);
    }
    const files = await this.packageVersionFileService.syncPackageVersionFiles(packageVersion);
    return files.map(file => formatFileItem(file));
  }

  @HTTPMethod({
    // GET /:fullname/:versionSpec/files => /:fullname/:versionSpec/files/${pkg.main}
    // GET /:fullname/:versionSpec/files?meta
    // GET /:fullname/:versionSpec/files/
    path: `/:fullname(${FULLNAME_REG_STRING})/:versionSpec/files`,
    method: HTTPMethodEnum.GET,
  })
  async listFiles(@Context() ctx: EggContext,
      @HTTPParam() fullname: string,
      @HTTPParam() versionSpec: string,
      @HTTPQuery() meta: string) {
    this.#requireUnpkgEnable();
    ctx.tValidate(Spec, `${fullname}@${versionSpec}`);
    ctx.vary(this.config.cnpmcore.cdnVaryHeader);
    const [ scope, name ] = getScopeAndName(fullname);
    const packageVersion = await this.#getPackageVersion(ctx, fullname, scope, name, versionSpec);
    ctx.set('cache-control', META_CACHE_CONTROL);
    const hasMeta = typeof meta === 'string' || ctx.path.endsWith('/files/');
    // meta request
    if (hasMeta) {
      const files = await this.#listFilesByDirectory(packageVersion, '/');
      if (!files) {
        throw new NotFoundError(`${fullname}@${versionSpec}/files not found`);
      }
      return files;
    }
    const { manifest } = await this.packageManagerService.showPackageVersionManifest(scope, name, versionSpec, false, true);
    // GET /foo/1.0.0/files => /foo/1.0.0/files/{main}
    // ignore empty entry exp: @types/node@20.2.5/
    const indexFile = manifest?.main || 'index.js';
    ctx.redirect(join(ctx.path, indexFile));
  }

  @HTTPMethod({
    // GET /:fullname/:versionSpec/files/:path
    // GET /:fullname/:versionSpec/files/:path?meta
    path: `/:fullname(${FULLNAME_REG_STRING})/:versionSpec/files/:path(.+)`,
    method: HTTPMethodEnum.GET,
  })
  async raw(@Context() ctx: EggContext,
      @HTTPParam() fullname: string,
      @HTTPParam() versionSpec: string,
      @HTTPParam() path: string,
      @HTTPQuery() meta: string) {
    this.#requireUnpkgEnable();
    ctx.tValidate(Spec, `${fullname}@${versionSpec}`);
    ctx.vary(this.config.cnpmcore.cdnVaryHeader);
    const [ scope, name ] = getScopeAndName(fullname);
    path = `/${path}`;
    const packageVersion = await this.#getPackageVersion(ctx, fullname, scope, name, versionSpec);
    if (path.endsWith('/')) {
      const directory = path.substring(0, path.length - 1);
      const files = await this.#listFilesByDirectory(packageVersion, directory);
      if (!files) {
        throw new NotFoundError(`${fullname}@${versionSpec}/files${directory} not found`);
      }
      ctx.set('cache-control', META_CACHE_CONTROL);
      return files;
    }

    const file = await this.packageVersionFileService.showPackageVersionFile(packageVersion, path);
    if (!file) {
      throw new NotFoundError(`File ${fullname}@${versionSpec}${path} not found`);
    }
    const hasMeta = typeof meta === 'string';
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

  async #getPackageVersion(ctx: EggContext, fullname: string, scope: string, name: string, versionSpec: string) {
    const { blockReason, packageVersion } = await this.packageManagerService.showPackageVersionByVersionOrTag(
      scope, name, versionSpec);
    if (blockReason) {
      this.setCDNHeaders(ctx);
      throw this.createPackageBlockError(blockReason, fullname, versionSpec);
    }
    if (!packageVersion) {
      throw new NotFoundError(`${fullname}@${versionSpec} not found`);
    }
    if (packageVersion.version !== versionSpec) {
      ctx.set('cache-control', META_CACHE_CONTROL);
      let location = ctx.url.replace(`/${fullname}/${versionSpec}/files`, `/${fullname}/${packageVersion.version}/files`);
      location = location.replace(`/${fullname}/${encodeURIComponent(versionSpec)}/files`, `/${fullname}/${packageVersion.version}/files`);
      throw this.createControllerRedirectError(location);
    }
    return packageVersion;
  }

  async #listFilesByDirectory(packageVersion: PackageVersion, directory: string) {
    const files = await this.packageVersionFileService.listPackageVersionFiles(packageVersion, directory);
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
