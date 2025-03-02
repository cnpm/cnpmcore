import {
  Context,
  EggContext,
  HTTPBody,
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  Inject,
  Middleware,
} from '@eggjs/tegg';
import { E400 } from 'egg-errors';
import { Static } from 'egg-typebox-validate-fengmk2/typebox';

import { AbstractController } from './AbstractController.js';
import { AdminAccess } from '../middleware/AdminAccess.js';
import { ScopeManagerService } from '../../core/service/ScopeManagerService.js';
import { RegistryManagerService } from '../../core/service/RegistryManagerService.js';
import { ScopeCreateOptions } from '../typebox.js';


@HTTPController()
export class ScopeController extends AbstractController {
  @Inject()
  private readonly scopeManagerService: ScopeManagerService;

  @Inject()
  private readonly registryManagerService: RegistryManagerService;

  @HTTPMethod({
    path: '/-/scope',
    method: HTTPMethodEnum.POST,
  })
  @Middleware(AdminAccess)
  async createScope(@Context() ctx: EggContext, @HTTPBody() scopeOptions: Static<typeof ScopeCreateOptions>) {
    const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'setting');
    ctx.tValidate(ScopeCreateOptions, scopeOptions);
    const { name, registryId } = scopeOptions;

    const registry = await this.registryManagerService.findByRegistryId(registryId);
    if (!registry) {
      throw new E400(`registry ${registryId} not found`);
    }

    await this.scopeManagerService.createScope({
      name,
      registryId,
      operatorId: authorizedUser.userId,
    });
    return { ok: true };
  }

  @HTTPMethod({
    path: '/-/scope/:id',
    method: HTTPMethodEnum.DELETE,
  })
  @Middleware(AdminAccess)
  async removeScope(@Context() ctx: EggContext, @HTTPParam() id: string) {
    const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'setting');
    await this.scopeManagerService.remove({ scopeId: id, operatorId: authorizedUser.userId });
    return { ok: true };
  }

}
