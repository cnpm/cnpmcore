import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  HTTPBody,
  Context,
  EggContext,
  Inject,
} from '@eggjs/tegg';
import { ForbiddenError } from 'egg-errors';
import { AbstractController } from './AbstractController';
import { FULLNAME_REG_STRING } from '../../common/PackageUtil';
import { PackageManagerService } from '../../core/service/PackageManagerService';
import { PackageVersionBlockRepository } from '../../repository/PackageVersionBlockRepository';
import { BlockPackageRule, BlockPackageType } from '../typebox';

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
  async blockPackage(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPBody() data: BlockPackageType) {
    const isAdmin = await this.userRoleManager.isAdmin(ctx);
    if (!isAdmin) {
      throw new ForbiddenError('Not allow to block package');
    }
    const params = { fullname, reason: data.reason };
    ctx.tValidate(BlockPackageRule, params);
    const packageEntity = await this.getPackageEntityByFullname(params.fullname);
    if (packageEntity.isPrivate) {
      throw new ForbiddenError(`Can\'t block private package "${params.fullname}"`);
    }

    const authorized = await this.userRoleManager.getAuthorizedUserAndToken(ctx);
    const block = await this.packageManagerService.blockPackage(packageEntity,
      `${params.reason} (operator: ${authorized?.user.name}/${authorized?.user.userId})`);
    ctx.logger.info('[PackageBlockController.blockPackage:success] fullname: %s, packageId: %s, packageVersionBlockId: %s',
      fullname, packageEntity.packageId, block.packageVersionBlockId);
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
  async unblockPackage(@Context() ctx: EggContext, @HTTPParam() fullname: string) {
    const isAdmin = await this.userRoleManager.isAdmin(ctx);
    if (!isAdmin) {
      throw new ForbiddenError('Not allow to unblock package');
    }
    const packageEntity = await this.getPackageEntityByFullname(fullname);
    if (packageEntity.isPrivate) {
      throw new ForbiddenError(`Can\'t unblock private package "${fullname}"`);
    }

    await this.packageManagerService.unblockPackage(packageEntity);
    ctx.logger.info('[PackageBlockController.unblockPackage:success] fullname: %s, packageId: %s',
      fullname, packageEntity.packageId);
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
    const blocks = await this.packageVersionBlockRepository.listPackageVersionBlocks(packageEntity.packageId);
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
