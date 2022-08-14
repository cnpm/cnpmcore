import {
  Context,
  EggContext,
  HTTPBody,
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  Inject,
} from '@eggjs/tegg';
import { AbstractController } from './AbstractController';
import { Static, Type } from 'egg-typebox-validate/typebox';
import { RegistryService } from '../../core/service/RegistryService';
import { ForbiddenError } from 'egg-errors';
import { uniq } from 'lodash';

const RegistryCreateOptions = Type.Object({
  name: Type.String({
    transform: [ 'trim' ],
    minLength: 1,
    maxLength: 256,
  }),
  host: Type.String({
    transform: [ 'trim' ],
    minLength: 1,
    maxLength: 4096,
  }),
  changeStream: Type.String({
    transform: [ 'trim' ],
    minLength: 1,
    maxLength: 4096,
  }),
  userPrefix: Type.Optional(Type.String({
    transform: [ 'trim' ],
    minLength: 1,
    maxLength: 256,
  })),
  type: Type.String({
    transform: [ 'trim' ],
    minLength: 1,
    maxLength: 256,
  }),
  scopes: Type.Array(Type.String({
    transform: [ 'trim' ],
    minLength: 1,
    maxLength: 214,
  })),
});

const RegistryRemoveOptions = Type.Object({
  name: Type.Optional(Type.String({
    transform: [ 'trim' ],
    minLength: 1,
    maxLength: 256,
  })),
  registryId: Type.Optional(Type.String({
    transform: [ 'trim' ],
    minLength: 1,
    maxLength: 256,
  })),
});


@HTTPController()
export class RegistryController extends AbstractController {
  @Inject()
  private readonly registryService: RegistryService;

  @HTTPMethod({
    path: '/-/registry',
    method: HTTPMethodEnum.GET,
  })
  async listRegistries() {
    return await this.registryService.list();
  }

  @HTTPMethod({
    path: '/-/registry',
    method: HTTPMethodEnum.POST,
  })
  async createRegistry(@Context() ctx: EggContext, @HTTPBody() registryOptions: Static<typeof RegistryCreateOptions>) {
    const isAdmin = await this.userRoleManager.isAdmin(ctx);
    if (!isAdmin) {
      throw new ForbiddenError('Not allow to create registry');
    }
    // verify unique name, scopes
    ctx.tValidate(RegistryCreateOptions, registryOptions);
    const { name, changeStream, scopes: originScopes, host, userPrefix = '', type } = registryOptions;
    const scopes = uniq(originScopes);

    // need transaction
    await this.registryService.update({
      name,
      changeStream,
      scopes,
      host,
      userPrefix,
      type,
    });
    return { ok: true };
  }

  @HTTPMethod({
    path: '/-/registry',
    method: HTTPMethodEnum.DELETE,
  })
  async removeRegistry(@Context() ctx: EggContext, @HTTPBody() registryOptions: Static<typeof RegistryRemoveOptions>) {
    const isAdmin = await this.userRoleManager.isAdmin(ctx);
    if (!isAdmin) {
      throw new ForbiddenError('Not allow to delete registry');
    }
    ctx.tValidate(RegistryRemoveOptions, registryOptions);
    await this.registryService.remove(registryOptions);
    return { ok: true };
  }

}
