import { AccessLevel, Inject, SingletonProto } from '@eggjs/tegg';
import type { ScopeRepository } from '../../repository/ScopeRepository.js';
import { AbstractService } from '../../common/AbstractService.js';
import { Scope } from '../entity/Scope.js';
import type { PageOptions, PageResult } from '../util/EntityUtil.js';

export interface CreateScopeCmd extends Pick<Scope, 'name' | 'registryId'> {
  operatorId?: string;
}
export interface UpdateRegistryCmd
  extends Pick<Scope, 'name' | 'scopeId' | 'registryId'> {
  operatorId?: string;
}

export interface RemoveScopeCmd {
  scopeId: string;
  operatorId?: string;
}

export interface RemoveScopeByRegistryIdCmd {
  registryId: string;
  operatorId?: string;
}
@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class ScopeManagerService extends AbstractService {
  @Inject()
  private readonly scopeRepository: ScopeRepository;

  async findByName(name: string): Promise<Scope | null> {
    const scope = await this.scopeRepository.findByName(name);
    return scope;
  }

  async countByRegistryId(registryId: string): Promise<number> {
    const count = await this.scopeRepository.countByRegistryId(registryId);
    return count;
  }

  async createScope(createCmd: CreateScopeCmd): Promise<Scope> {
    const { name, registryId, operatorId } = createCmd;
    this.logger.info(
      '[ScopeManagerService.CreateScope:prepare] operatorId: %s, createCmd: %s',
      operatorId,
      createCmd
    );
    const scope = Scope.create({
      name,
      registryId,
    });
    await this.scopeRepository.saveScope(scope);
    return scope;
  }

  async listScopes(page: PageOptions): Promise<PageResult<Scope>> {
    return await this.scopeRepository.listScopes(page);
  }

  async listScopesByRegistryId(
    registryId: string,
    page: PageOptions
  ): Promise<PageResult<Scope>> {
    return await this.scopeRepository.listScopesByRegistryId(registryId, page);
  }

  async removeByRegistryId(
    removeCmd: RemoveScopeByRegistryIdCmd
  ): Promise<void> {
    const { registryId, operatorId } = removeCmd;
    this.logger.info(
      '[ScopeManagerService.remove:prepare] operatorId: %s, registryId: %s',
      operatorId,
      registryId
    );
    return await this.scopeRepository.removeScopeByRegistryId(registryId);
  }

  async remove(removeCmd: RemoveScopeCmd): Promise<void> {
    const { scopeId, operatorId } = removeCmd;
    this.logger.info(
      '[ScopeManagerService.remove:prepare] operatorId: %s, scopeId: %s',
      operatorId,
      scopeId
    );
    return await this.scopeRepository.removeScope(scopeId);
  }
}
