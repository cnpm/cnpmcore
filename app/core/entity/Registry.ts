import { Entity, type EntityData } from './Entity.js';
import { EntityUtil, type EasyData } from '../util/EntityUtil.js';
import type { RegistryType } from '../../common/enum/Registry.js';

interface RegistryData extends EntityData {
  name: string;
  registryId: string;
  host: string;
  changeStream: string;
  userPrefix: string;
  type: RegistryType;
  authToken?: string;
}

export type CreateRegistryData = Omit<
  EasyData<RegistryData, 'registryId'>,
  'id'
>;

export class Registry extends Entity {
  name: string;
  registryId: string;
  host: string;
  changeStream: string;
  userPrefix: string;
  type: RegistryType;
  authToken?: string;

  constructor(data: RegistryData) {
    super(data);
    this.name = data.name;
    this.registryId = data.registryId;
    this.host = data.host;
    this.changeStream = data.changeStream;
    this.userPrefix = data.userPrefix;
    this.type = data.type;
    this.authToken = data.authToken;
  }

  public static create(data: CreateRegistryData): Registry {
    const newData = EntityUtil.defaultData<RegistryData, 'registryId'>(
      data,
      'registryId'
    );
    return new Registry(newData);
  }
}
