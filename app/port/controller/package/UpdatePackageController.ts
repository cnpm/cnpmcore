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
    const npmCommand = ctx.get('npm-command');
    if (npmCommand === 'unpublish') {
      // ignore it
      return { ok: false };
    }
    // only support update maintainer
    if (npmCommand !== 'owner') {
      throw new BadRequestError(`header: npm-command expected "owner", but got "${npmCommand}"`);
    }
    ctx.tValidate(MaintainerDataRule, data);
    const pkg = await this.getPackageEntityAndRequiredMaintainer(ctx, fullname);
    // make sure all maintainers exists
    const users: UserEntity[] = [];
    for (const maintainer of data.maintainers) {
      const user = await this.userRepository.findUserByName(maintainer.name);
      if (!user) {
        throw new UnprocessableEntityError(`Maintainer "${maintainer.name}" not exists`);
      }
      users.push(user);
    }
    await this.packageManagerService.replacePackageMaintainers(pkg, users);
    return { ok: true };
  }
}
