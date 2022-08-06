import {
  AccessLevel,
  ContextProto,
  Inject,
} from '@eggjs/tegg';
import { RegistryRepository } from '../../repository/RegistryRepository';
import { AbstractService } from '../../common/AbstractService';
import { Registry as RegistryModel } from '../../repository/model/Registry';
import { ScopeRepository } from '../../repository/ScopeRepository';
import { Scope } from '../entity/Scope';
import pMap from 'p-map';
import { Registry } from '../entity/Registry';

export type CreateCmd = {
  name: string;
  scopes: string[];
} & Pick<RegistryModel, 'changeStream' | 'host' | 'userPrefix'>

export type RemoveCmd = {
  name?: string;
  registryId?: string;
};

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class RegistryService extends AbstractService {
  @Inject()
  private readonly registryRepository: RegistryRepository;

  @Inject()
  private readonly scopeRepository: ScopeRepository;

  async update(createCmd: CreateCmd) {
    const { name, scopes, changeStream, host, userPrefix } = createCmd;
    // save Registry
    const registryModel = await this.registryRepository.saveRegistry(Registry.create(
      {
        name, changeStream, host, userPrefix
      }
    ));

    if (registryModel) {
      // Save Scopes
      // May be need transaction
      for (let scope of scopes) {
        const scopeModel = Scope.create({ name: scope, registryId: registryModel.registryId });
        await this.scopeRepository.saveScope(scopeModel);
      }
    }
  }

  // list all registries with scopes
  async list(): Promise<(Registry & { scopes: Scope[] })[]> {
    const registryModels = await this.registryRepository.listRegistries();
    return pMap(registryModels, async registryModel => {
      const scopes = await this.scopeRepository.listScopesByRegistryId(registryModel.registryId);
      return {
        ...registryModel,
        scopes,
      };
    }, { concurrency: 5 });
  }

  // remove repository
  async remove(removeCmd: RemoveCmd): Promise<void> {
    let registryModel: Registry | null;

    if (removeCmd.name) {
      registryModel = await this.registryRepository.findRegistry(removeCmd.name);
      if (!registryModel) {
        return;
      }
      await this.registryRepository.removeRegistry(registryModel.registryId);
    }
    if (removeCmd.registryId) {
      await this.registryRepository.removeRegistry(removeCmd.registryId);
    }
  }

}
