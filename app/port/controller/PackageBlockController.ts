import {
  HTTPContext,
  Context,
  HTTPBody,
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  Inject,
  Middleware,
} from 'egg';
import { ForbiddenError } from '@eggjs/errors';

import { AbstractController } from './AbstractController.ts';
import { FULLNAME_REG_STRING } from '../../common/PackageUtil.ts';
import type { PackageManagerService } from '../../core/service/PackageManagerService.ts';
import type { PackageVersionBlockRepository } from '../../repository/PackageVersionBlockRepository.ts';
import { BlockPackageRule, type BlockPackageType } from '../typebox.ts';
import { AdminAccess } from '../middleware/AdminAccess.ts';

@HTTPController()
export class PackageBlockController extends AbstractController {
  @Inject()
  private packageManagerService: PackageManagerService;
  @Inject()
  private packageVersionBlockRepository: PackageVersionBlockRepository;

  @HTTPMethod({
    // PUT /-/package/:fullname/blocks
    path: `/-/package/:fullname(${FULLNAME_REG_STRING})/blocks`,
    method: HTTPMethodEnum.PUT,
  })
  @Middleware(AdminAccess)
  async blockPackage(
    @HTTPContext() ctx: Context,
    @HTTPParam() fullname: string,
    @HTTPBody() data: BlockPackageType
  ) {
    const params = { fullname, reason: data.reason };
    ctx.tValidate(BlockPackageRule, params);
    const packageEntity = await this.getPackageEntityByFullname(
      params.fullname
    );
    if (packageEntity.isPrivate) {
      throw new ForbiddenError(
        `Can't block private package "${params.fullname}"`
      );
    }

    const authorized =
      await this.userRoleManager.getAuthorizedUserAndToken(ctx);
    const block = await this.packageManagerService.blockPackage(
      packageEntity,
      `${params.reason} (operator: ${authorized?.user.name}/${authorized?.user.userId})`
    );
    ctx.logger.info(
      '[PackageBlockController.blockPackage:success] fullname: %s, packageId: %s, packageVersionBlockId: %s',
      fullname,
      packageEntity.packageId,
      block.packageVersionBlockId
    );
    ctx.status = 201;
    return {
      ok: true,
      id: block.packageVersionBlockId,
      package_id: packageEntity.packageId,
    };
  }

  @HTTPMethod({
    // DELETE /-/package/:fullname/blocks
    path: `/-/package/:fullname(${FULLNAME_REG_STRING})/blocks`,
    method: HTTPMethodEnum.DELETE,
  })
  @Middleware(AdminAccess)
  async unblockPackage(
    @HTTPContext() ctx: Context,
    @HTTPParam() fullname: string
  ) {
    const packageEntity = await this.getPackageEntityByFullname(fullname);
    if (packageEntity.isPrivate) {
      throw new ForbiddenError(`Can't unblock private package "${fullname}"`);
    }

    await this.packageManagerService.unblockPackage(packageEntity);
    ctx.logger.info(
      '[PackageBlockController.unblockPackage:success] fullname: %s, packageId: %s',
      fullname,
      packageEntity.packageId
    );
    return {
      ok: true,
    };
  }

  @HTTPMethod({
    // GET /-/package/:fullname/blocks
    path: `/-/package/:fullname(${FULLNAME_REG_STRING})/blocks`,
    method: HTTPMethodEnum.GET,
  })
  async listPackageBlocks(@HTTPParam() fullname: string) {
    const packageEntity = await this.getPackageEntityByFullname(fullname);
    const blocks =
      await this.packageVersionBlockRepository.listPackageVersionBlocks(
        packageEntity.packageId
      );
    return {
      data: blocks.map(block => {
        return {
          id: block.packageVersionBlockId,
          version: block.version,
          reason: block.reason,
          created: block.createdAt,
          modified: block.updatedAt,
        };
      }),
    };
  }
}
