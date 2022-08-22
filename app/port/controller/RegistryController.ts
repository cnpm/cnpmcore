import {
  Context,
  EggContext,
  HTTPBody,
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  HTTPQuery,
  Inject,
  Middleware,
} from '@eggjs/tegg';
import { NotFoundError } from 'egg-errors';
import { AbstractController } from './AbstractController';
import { Static } from 'egg-typebox-validate/typebox';
import { RegistryManagerService } from '../../core/service/RegistryManagerService';
import { AdminAccess } from '../middleware/AdminAccess';
import { ScopeManagerService } from '../../core/service/ScopeManagerService';
import { RegistryCreateOptions, QueryPageOptions } from '../typebox';

@HTTPController()
export class RegistryController extends AbstractController {
  @Inject()
  private readonly registryManagerService: RegistryManagerService;
  @Inject()
  private readonly scopeManagerService: ScopeManagerService;

  @HTTPMethod({
    path: '/-/registry',
    method: HTTPMethodEnum.GET,
  })
  async listRegistries(@HTTPQuery() pageSize: Static<typeof QueryPageOptions>['pageSize'], @HTTPQuery() pageIndex: Static<typeof QueryPageOptions>['pageIndex']) {
    const registries = await this.registryManagerService.listRegistries({ pageSize, pageIndex });
    return registries;
  }

  @HTTPMethod({
    path: '/-/registry/:id',
    method: HTTPMethodEnum.GET,
  })
  async showRegistry(@HTTPParam() id: string) {
    const registry = await this.registryManagerService.findByRegistryId(id);
    if (!registry) {
      throw new NotFoundError('registry not found');
    }
    return registry;
  }

  @HTTPMethod({
    path: '/-/registry/:id/scopes',
    method: HTTPMethodEnum.GET,
  })
  async showRegistryScopes(@HTTPParam() id: string, @HTTPQuery() pageSize: Static<typeof QueryPageOptions>['pageSize'], @HTTPQuery() pageIndex: Static<typeof QueryPageOptions>['pageIndex']) {
    const registry = await this.registryManagerService.findByRegistryId(id);
    if (!registry) {
      throw new NotFoundError('registry not found');
    }
    const scopes = await this.scopeManagerService.listScopesByRegistryId(id, { pageIndex, pageSize });
    return scopes;
  }

  @HTTPMethod({
    path: '/-/registry',
    method: HTTPMethodEnum.POST,
  })
  @Middleware(AdminAccess)
  async createRegistry(@Context() ctx: EggContext, @HTTPBody() registryOptions: Static<typeof RegistryCreateOptions>) {
    ctx.tValidate(RegistryCreateOptions, registryOptions);
    const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'setting');
    const { name, changeStream, host, userPrefix = '', type } = registryOptions;
    await this.registryManagerService.createRegistry({
      name,
      changeStream,
      host,
      userPrefix,
      operatorId: authorizedUser.userId,
      type,
    });
    return { ok: true };
  }

  @HTTPMethod({
    path: '/-/registry/:id',
    method: HTTPMethodEnum.DELETE,
  })
  @Middleware(AdminAccess)
  async removeRegistry(@Context() ctx: EggContext, @HTTPParam() id: string) {
    const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'setting');
    await this.registryManagerService.remove({ registryId: id, operatorId: authorizedUser.userId });
    return { ok: true };
  }

}
