import {
  Context,
  HTTPContext,
  HTTPBody,
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  Inject,
  Middleware,
} from 'egg';
import { E400 } from '@eggjs/errors';
import type { Static } from '@eggjs/typebox-validate/typebox';

import { AbstractController } from './AbstractController.ts';
import { AdminAccess } from '../middleware/AdminAccess.ts';
import type { ScopeManagerService } from '../../core/service/ScopeManagerService.ts';
import type { RegistryManagerService } from '../../core/service/RegistryManagerService.ts';
import { ScopeCreateOptions } from '../typebox.ts';

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
  async createScope(
    @HTTPContext() ctx: Context,
    @HTTPBody() scopeOptions: Static<typeof ScopeCreateOptions>
  ) {
    const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(
      ctx,
      'setting'
    );
    ctx.tValidate(ScopeCreateOptions, scopeOptions);
    const { name, registryId } = scopeOptions;

    const registry =
      await this.registryManagerService.findByRegistryId(registryId);
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
  async removeScope(@HTTPContext() ctx: Context, @HTTPParam() id: string) {
    const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(
      ctx,
      'setting'
    );
    await this.scopeManagerService.remove({
      scopeId: id,
      operatorId: authorizedUser.userId,
    });
    return { ok: true };
  }
}
