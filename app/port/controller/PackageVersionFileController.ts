import { join } from 'node:path';
import type { EggContext } from '@eggjs/tegg';
import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  HTTPQuery,
  Inject,
  Context,
  Middleware,
} from '@eggjs/tegg';
import { NotFoundError } from 'egg-errors';

import { AbstractController } from './AbstractController.js';
import { AdminAccess } from '../middleware/AdminAccess.js';
import {
  getScopeAndName,
  FULLNAME_REG_STRING,
} from '../../common/PackageUtil.js';
import type { PackageVersionFileService } from '../../core/service/PackageVersionFileService.js';
import type { PackageManagerService } from '../../core/service/PackageManagerService.js';
import type { PackageVersionFile } from '../../core/entity/PackageVersionFile.js';
import type { PackageVersion } from '../../core/entity/PackageVersion.js';
import type { DistRepository } from '../../repository/DistRepository.js';
import { Spec } from '../typebox.js';

type FileItem = {
  path: string;
  type: 'file';
  contentType: string;
  integrity: string;
  lastModified: Date;
  size: number;
};

type DirectoryItem = {
  path: string;
  type: 'directory';
  files: (DirectoryItem | FileItem)[];
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
  async sync(
    @Context() ctx: EggContext,
    @HTTPParam() fullname: string,
    @HTTPParam() versionSpec: string
  ) {
    ctx.tValidate(Spec, `${fullname}@${versionSpec}`);
    this.#requireUnpkgEnable();
    const [scope, name] = getScopeAndName(fullname);
    const { packageVersion } =
      await this.packageManagerService.showPackageVersionByVersionOrTag(
        scope,
        name,
        versionSpec
      );
    if (!packageVersion) {
      throw new NotFoundError(`${fullname}@${versionSpec} not found`);
    }
    const files =
      await this.packageVersionFileService.syncPackageVersionFiles(
        packageVersion
      );
    return files.map(file => formatFileItem(file));
  }

  @HTTPMethod({
    // GET /:fullname/:versionSpec/files => /:fullname/:versionSpec/files/${pkg.main}
    // GET /:fullname/:versionSpec/files?meta
    // GET /:fullname/:versionSpec/files/
    path: `/:fullname(${FULLNAME_REG_STRING})/:versionSpec/files`,
    method: HTTPMethodEnum.GET,
  })
  async listFiles(
    @Context() ctx: EggContext,
    @HTTPParam() fullname: string,
    @HTTPParam() versionSpec: string,
    @HTTPQuery() meta: string
  ) {
    this.#requireUnpkgEnable();
    ctx.tValidate(Spec, `${fullname}@${versionSpec}`);
    ctx.vary(this.config.cnpmcore.cdnVaryHeader);
    const [scope, name] = getScopeAndName(fullname);
    const packageVersion = await this.#getPackageVersion(
      ctx,
      fullname,
      scope,
      name,
      versionSpec
    );
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
    const { manifest } =
      await this.packageManagerService.showPackageVersionManifest(
        scope,
        name,
        versionSpec,
        false,
        true
      );
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
  async raw(
    @Context() ctx: EggContext,
    @HTTPParam() fullname: string,
    @HTTPParam() versionSpec: string,
    @HTTPParam() path: string,
    @HTTPQuery() meta: string
  ) {
    this.#requireUnpkgEnable();
    ctx.tValidate(Spec, `${fullname}@${versionSpec}`);
    ctx.vary(this.config.cnpmcore.cdnVaryHeader);
    const [scope, name] = getScopeAndName(fullname);
    path = `/${path}`;
    const packageVersion = await this.#getPackageVersion(
      ctx,
      fullname,
      scope,
      name,
      versionSpec
    );
    if (path.endsWith('/')) {
      const directory = path.substring(0, path.length - 1);
      const files = await this.#listFilesByDirectory(packageVersion, directory);
      if (!files) {
        throw new NotFoundError(
          `${fullname}@${versionSpec}/files${directory} not found`
        );
      }
      ctx.set('cache-control', META_CACHE_CONTROL);
      return files;
    }

    await this.packageVersionFileService.checkPackageVersionInUnpkgWhiteList(
      scope,
      name,
      packageVersion.version
    );
    const file = await this.packageVersionFileService.showPackageVersionFile(
      packageVersion,
      path
    );
    const hasMeta = typeof meta === 'string';

    if (!file) {
      const possibleFile = await this.#searchPossibleEntries(
        packageVersion,
        path
      );
      if (possibleFile) {
        const route = `/${fullname}/${versionSpec}/files${possibleFile.path}${hasMeta ? '?meta' : ''}`;
        ctx.redirect(route);
        return;
      }

      throw new NotFoundError(
        `File ${fullname}@${versionSpec}${path} not found`
      );
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

  /**
   * compatibility with unpkg
   * 1. try to match alias entry. e.g. accessing `index.js` or `index.json` using /index
   * 2. if given path is directory and has `index.js` file, redirect to it. e.g. using `lib` alias to access `lib/index.js` or `lib/index.json`
   * @param {PackageVersion} packageVersion packageVersion
   * @param {String} path  filepath
   * @returns {Promise<PackageVersionFile | undefined>} return packageVersionFile or null
   */
  async #searchPossibleEntries(packageVersion: PackageVersion, path: string) {
    const possiblePath = [
      `${path}.js`,
      `${path}.json`,
      `${path}/index.js`,
      `${path}/index.json`,
    ];

    for (const pathItem of possiblePath) {
      const file = await this.packageVersionFileService.showPackageVersionFile(
        packageVersion,
        pathItem
      );

      if (file) {
        return file;
      }
    }
  }

  async #getPackageVersion(
    ctx: EggContext,
    fullname: string,
    scope: string,
    name: string,
    versionSpec: string
  ) {
    const { blockReason, packageVersion } =
      await this.packageManagerService.showPackageVersionByVersionOrTag(
        scope,
        name,
        versionSpec
      );
    if (blockReason) {
      this.setCDNHeaders(ctx);
      throw this.createPackageBlockError(blockReason, fullname, versionSpec);
    }
    if (!packageVersion) {
      throw new NotFoundError(`${fullname}@${versionSpec} not found`);
    }
    if (packageVersion.version !== versionSpec) {
      ctx.set('cache-control', META_CACHE_CONTROL);
      let location = ctx.url.replace(
        `/${fullname}/${versionSpec}/files`,
        `/${fullname}/${packageVersion.version}/files`
      );
      location = location.replace(
        `/${fullname}/${encodeURIComponent(versionSpec)}/files`,
        `/${fullname}/${packageVersion.version}/files`
      );
      throw this.createControllerRedirectError(location);
    }
    return packageVersion;
  }

  async #listFilesByDirectory(
    packageVersion: PackageVersion,
    directory: string
  ) {
    const { files, directories } =
      await this.packageVersionFileService.listPackageVersionFiles(
        packageVersion,
        directory
      );
    if (files.length === 0 && directories.length === 0) return null;

    const info: DirectoryItem = {
      path: directory,
      type: 'directory',
      files: [],
    };
    for (const file of files) {
      info.files.push(formatFileItem(file));
    }
    for (const name of directories) {
      info.files.push({
        path: name,
        type: 'directory',
        files: [],
      } as DirectoryItem);
    }
    return info;
  }
}
