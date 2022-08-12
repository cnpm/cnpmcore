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
import { RegistryType } from 'app/common/enum/registry';

export type CreateCmd = {
  id?: bigint;
  registryId?: string;
  name: string;
  scopes: string[];
} & Pick<RegistryModel, 'changeStream' | 'host' | 'userPrefix' | 'type'>;

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
    const { name, scopes, changeStream, host, userPrefix, type, id, registryId } = createCmd;
    if (registryId) {
      // remove Scopes
      await this.scopeRepository.removeScopeByRegistryId(registryId);
    }
    // save Registry
    const registryModel = await this.registryRepository.saveRegistry(Registry.create(
      {
        id, name, changeStream, host, userPrefix, type: type as RegistryType,
      },
    ));

    if (registryModel) {
      // Save Scopes
      for (const scope of scopes) {
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

    let registryId: string | undefined;
    if (removeCmd.name) {
      registryModel = await this.registryRepository.findRegistry(removeCmd.name);
      if (!registryModel) {
        return;
      }
      registryId = registryModel.registryId;
    }

    registryId = registryId || removeCmd.registryId;

    if (registryId) {
      await this.registryRepository.removeRegistry(registryId);
      await this.scopeRepository.removeScopeByRegistryId(registryId);
    }

  }

}
