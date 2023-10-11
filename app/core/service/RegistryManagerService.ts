import {
  AccessLevel,
  SingletonProto,
  Inject,
} from '@eggjs/tegg';
import { E400, NotFoundError } from 'egg-errors';
import { RegistryRepository } from '../../repository/RegistryRepository';
import { AbstractService } from '../../common/AbstractService';
import { Registry } from '../entity/Registry';
import { PageOptions, PageResult } from '../util/EntityUtil';
import { ScopeManagerService } from './ScopeManagerService';
import { TaskService } from './TaskService';
import { Task } from '../entity/Task';
import { ChangesStreamMode, PresetRegistryName } from '../../common/constants';
import { RegistryType } from '../../common/enum/Registry';

export interface CreateRegistryCmd extends Pick<Registry, 'changeStream' | 'host' | 'userPrefix' | 'type' | 'name' | 'authToken' > {
  operatorId?: string;
}
export interface UpdateRegistryCmd extends Pick<Registry, 'changeStream' | 'host' | 'type' | 'name' | 'authToken' > {
  operatorId?: string;
}
export interface RemoveRegistryCmd extends Pick<Registry, 'registryId'> {
  operatorId?: string;
}

export interface StartSyncCmd {
  registryId: string;
  since?: string;
  operatorId?: string;
}

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class RegistryManagerService extends AbstractService {
  @Inject()
  private readonly registryRepository: RegistryRepository;
  @Inject()
  private readonly scopeManagerService: ScopeManagerService;
  @Inject()
  private readonly taskService: TaskService;

  async createSyncChangesStream(startSyncCmd: StartSyncCmd): Promise<void> {
    const { registryId, operatorId = '-', since } = startSyncCmd;
    this.logger.info('[RegistryManagerService.startSyncChangesStream:prepare] operatorId: %s, registryId: %s, since: %s', operatorId, registryId, since);
    const registry = await this.registryRepository.findRegistryByRegistryId(registryId);
    if (!registry) {
      throw new NotFoundError(`registry ${registryId} not found`);
    }

    // 防止和 GLOBAL_WORKER 冲突，只能有一个默认的全局 registry
    const scopesCount = await this.scopeManagerService.countByRegistryId(registryId);
    if (scopesCount === 0) {
      throw new E400(`registry ${registryId} has no scopes, please create scopes first`);
    }

    // 启动 changeStream
    const targetName = `${registry.name.toUpperCase()}_WORKER`;
    await this.taskService.createTask(Task.createChangesStream(targetName, registryId, since), false);
  }

  async createRegistry(createCmd: CreateRegistryCmd): Promise<Registry> {
    const { name, changeStream = '', host, userPrefix = '', type, operatorId = '-', authToken } = createCmd;
    this.logger.info('[RegistryManagerService.createRegistry:prepare] operatorId: %s, createCmd: %j', operatorId, createCmd);
    const registry = Registry.create({
      name,
      changeStream,
      host,
      userPrefix,
      type,
      authToken,
    });
    await this.registryRepository.saveRegistry(registry);
    return registry;
  }

  // 更新部分 registry 信息
  // 不允许 userPrefix 字段变更
  async updateRegistry(registryId: string, updateCmd: UpdateRegistryCmd) {
    const { name, changeStream, host, type, operatorId = '-', authToken } = updateCmd;
    this.logger.info('[RegistryManagerService.updateRegistry:prepare] operatorId: %s, updateCmd: %j', operatorId, updateCmd);
    const registry = await this.registryRepository.findRegistryByRegistryId(registryId);
    if (!registry) {
      throw new NotFoundError(`registry ${registryId} not found`);
    }
    Object.assign(registry, {
      name,
      changeStream,
      host,
      type,
      authToken,
    });
    await this.registryRepository.saveRegistry(registry);
  }

  // list all registries with scopes
  async listRegistries(page: PageOptions): Promise<PageResult<Registry>> {
    return await this.registryRepository.listRegistries(page);
  }

  async findByRegistryId(registryId: string): Promise<Registry | null> {
    return await this.registryRepository.findRegistryByRegistryId(registryId);
  }

  async findByRegistryName(registryName?: string): Promise<Registry | null> {
    return await this.registryRepository.findRegistry(registryName);
  }

  async findByRegistryHost(host?: string): Promise<Registry | null> {
    return host ? await this.registryRepository.findRegistryByRegistryHost(host) : null;
  }

  // 删除 Registry 方法
  // 可选传入 operatorId 作为参数，用于记录操作人员
  // 同时删除对应的 scope 数据
  async remove(removeCmd: RemoveRegistryCmd): Promise<void> {
    const { registryId, operatorId = '-' } = removeCmd;
    this.logger.info('[RegistryManagerService.remove:prepare] operatorId: %s, registryId: %s', operatorId, registryId);
    await this.registryRepository.removeRegistry(registryId);
    await this.scopeManagerService.removeByRegistryId({ registryId, operatorId });
  }

  async ensureSelfRegistry(): Promise<Registry> {
    const existRegistry = await this.registryRepository.findRegistry(PresetRegistryName.self);
    if (existRegistry) {
      return existRegistry;
    }

    const { registry: registryHost } = this.config.cnpmcore;

    const newRegistry = await this.createRegistry({
      name: PresetRegistryName.self,
      host: registryHost,
      type: RegistryType.Cnpmcore,
      changeStream: '',
      userPrefix: '',
    });

    return newRegistry;

  }

  async ensureDefaultRegistry(): Promise<Registry> {
    const existRegistry = await this.registryRepository.findRegistry(PresetRegistryName.default);
    if (existRegistry) {
      return existRegistry;
    }

    // 从配置文件默认生成
    const { changesStreamRegistryMode, changesStreamRegistry: changesStreamHost, sourceRegistry: host } = this.config.cnpmcore;
    const type = changesStreamRegistryMode === ChangesStreamMode.json ? RegistryType.Cnpmcore : RegistryType.Npm;
    const registry = await this.createRegistry({
      name: PresetRegistryName.default,
      type,
      userPrefix: 'npm:',
      host,
      changeStream: `${changesStreamHost}/_changes`,
    });

    return registry;

  }

  async getAuthTokenByRegistryHost(host: string): Promise<string|undefined> {
    const registry = await this.findByRegistryHost(host);
    if (!registry) {
      return undefined;
    }
    return registry.authToken;
  }

}
