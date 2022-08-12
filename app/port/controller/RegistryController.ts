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
    // TODO only admins can create registry
    // verify unique name, scopes
    ctx.tValidate(RegistryCreateOptions, registryOptions);
    const { name, changeStream, scopes, host, userPrefix = '', type } = registryOptions;
    return await this.registryService.update({
      name,
      changeStream,
      scopes,
      host,
      userPrefix,
      type,
    });
  }

  @HTTPMethod({
    path: '/-/registry',
    method: HTTPMethodEnum.DELETE,
  })
  async removeRegistry(@Context() ctx: EggContext, @HTTPBody() registryOptions: Static<typeof RegistryRemoveOptions>) {
    // TODO only admins can create registry
    // verify unique name, scopes
    ctx.tValidate(RegistryRemoveOptions, registryOptions);
    return await this.registryService.remove(registryOptions);
  }

}
