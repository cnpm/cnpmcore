import { Entity, EntityData } from './Entity';
import { EasyData, EntityUtil } from '../util/EntityUtil';
import type { RegistryType } from '../../common/enum/Registry';

interface RegistryData extends EntityData {
  name: string;
  registryId: string;
  host: string;
  changeStream: string;
  userPrefix: string;
  type: RegistryType;
}

export type CreateRegistryData = Omit<EasyData<RegistryData, 'registryId'>, 'id'>;

export class Registry extends Entity {
  name: string;
  registryId: string;
  host: string;
  changeStream: string;
  userPrefix: string;
  type: RegistryType;

  constructor(data: RegistryData) {
    super(data);
    this.name = data.name;
    this.registryId = data.registryId;
    this.host = data.host;
    this.changeStream = data.changeStream;
    this.userPrefix = data.userPrefix;
    this.type = data.type;
  }

  public static create(data: CreateRegistryData): Registry {
    const newData = EntityUtil.defaultData(data, 'registryId');
    return new Registry(newData);
  }
}
