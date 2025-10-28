import { BadRequestError, UnprocessableEntityError } from 'egg/errors';
import {
  HTTPContext,
  Context,
  HTTPBody,
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  Inject,
} from 'egg';
import { Type, type Static } from '@eggjs/typebox-validate/typebox';

import { AbstractController } from '../AbstractController.ts';
import { FULLNAME_REG_STRING } from '../../../common/PackageUtil.ts';
import type { User as UserEntity } from '../../../core/entity/User.ts';
import type { PackageManagerService } from '../../../core/service/PackageManagerService.ts';

const MaintainerDataRule = Type.Object({
  maintainers: Type.Array(
    Type.Object({
      name: Type.String({ minLength: 1, maxLength: 100 }),
      email: Type.String({ format: 'email', maxLength: 400 }),
    }),
    { minItems: 1 }
  ),
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
  async update(
    @HTTPContext() ctx: Context,
    @HTTPParam() fullname: string,
    @HTTPBody() data: Maintainer
  ) {
    if (this.isNpmCommandValid(ctx, 'unpublish')) {
      // ignore it
      return { ok: false };
    }
    // only support update maintainer
    if (!this.isNpmCommandValid(ctx, 'owner')) {
      const npmCommand = this.getNpmCommand(ctx);
      throw new BadRequestError(
        `header: npm-command expected "owner", but got "${npmCommand}"`
      );
    }
    ctx.tValidate(MaintainerDataRule, data);
    const ensureRes = await this.ensurePublishAccess(ctx, fullname, true);
    const pkg = ensureRes.pkg;
    const registry = await this.packageManagerService.getSourceRegistry(pkg);
    // make sure all maintainers exists
    const users: UserEntity[] = [];
    for (const maintainer of data.maintainers) {
      if (
        registry?.userPrefix &&
        !maintainer.name.startsWith(registry.userPrefix)
      ) {
        maintainer.name = `${registry?.userPrefix}${maintainer.name}`;
      }
      const user = await this.userRepository.findUserByName(maintainer.name);
      if (!user) {
        throw new UnprocessableEntityError(
          `Maintainer "${maintainer.name}" not exists`
        );
      }
      users.push(user);
    }

    await this.packageManagerService.replacePackageMaintainersAndDist(
      pkg,
      users
    );
    return { ok: true };
  }

  private getNpmCommand(ctx: Context) {
    // npm@6: referer: 'xxx [REDACTED]'
    // npm@>=7: 'npm-command': 'xxx'
    let npmCommand = ctx.get<string>('npm-command');
    if (!npmCommand) {
      npmCommand = ctx.get<string>('referer').split(' ', 1)[0];
    }

    return npmCommand;
  }

  private isNpmCommandValid(ctx: Context, expectCommand: string) {
    const npmCommand = this.getNpmCommand(ctx);

    return npmCommand === expectCommand;
  }
}
