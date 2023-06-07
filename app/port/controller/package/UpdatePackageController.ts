import {
  UnprocessableEntityError,
  BadRequestError,
} from 'egg-errors';
import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  HTTPBody,
  Inject,
  Context,
  EggContext,
} from '@eggjs/tegg';
import { Static, Type } from '@sinclair/typebox';
import { AbstractController } from '../AbstractController';
import { FULLNAME_REG_STRING } from '../../../common/PackageUtil';
import { User as UserEntity } from '../../../core/entity/User';
import { PackageManagerService } from '../../../core/service/PackageManagerService';

const MaintainerDataRule = Type.Object({
  maintainers: Type.Array(Type.Object({
    name: Type.String({ minLength: 1, maxLength: 100 }),
    email: Type.String({ format: 'email', maxLength: 400 }),
  }), { minItems: 1 }),
});
type Maintainer = Static<typeof MaintainerDataRule>;

@HTTPController()
export class UpdatePackageController extends AbstractController {
  @Inject()
  private packageManagerService: PackageManagerService;

  // https://github.com/npm/cli/blob/latest/lib/commands/owner.js#L191
  @HTTPMethod({
    // PUT /:fullname/-rev/:rev
    path: `/:fullname(${FULLNAME_REG_STRING})/-rev/:rev`,
    method: HTTPMethodEnum.PUT,
  })
  async update(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPBody() data: Maintainer) {
    if (this.isNpmCommandValid(ctx, 'unpublish')) {
      // ignore it
      return { ok: false };
    }
    // only support update maintainer
    if (!this.isNpmCommandValid(ctx, 'owner')) {
      const npmCommand = this.getNpmCommand(ctx);
      throw new BadRequestError(`header: npm-command expected "owner", but got "${npmCommand}"`);
    }
    ctx.tValidate(MaintainerDataRule, data);
    const ensureRes = await this.ensurePublishAccess(ctx, fullname, true);
    const pkg = ensureRes.pkg!;
    const registry = await this.packageManagerService.getSourceRegistry(pkg);
    // make sure all maintainers exists
    const users: UserEntity[] = [];
    for (const maintainer of data.maintainers) {
      if (registry?.userPrefix && !maintainer.name.startsWith(registry.userPrefix)) {
        maintainer.name = `${registry?.userPrefix}${maintainer.name}`;
      }
      const user = await this.userRepository.findUserByName(maintainer.name);
      if (!user) {
        throw new UnprocessableEntityError(`Maintainer "${maintainer.name}" not exists`);
      }
      users.push(user);
    }

    await this.packageManagerService.replacePackageMaintainersAndDist(pkg, users);
    return { ok: true };
  }

  private getNpmCommand(ctx: EggContext) {
    // npm@6: referer: 'xxx [REDACTED]'
    // npm@>=7: 'npm-command': 'xxx'
    let npmCommand = ctx.get('npm-command');
    if (!npmCommand) {
      npmCommand = ctx.get('referer').split(' ', 1)[0];
    }

    return npmCommand;
  }

  private isNpmCommandValid(ctx: EggContext, expectCommand: string) {
    const npmCommand = this.getNpmCommand(ctx);

    return npmCommand === expectCommand;
  }
}
