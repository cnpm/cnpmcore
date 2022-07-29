import { Entity, EntityData } from './Entity';
import { EasyData, EntityUtil } from '../util/EntityUtil';

interface ScopeData extends EntityData {
  name: string;
  scopeId: string;
  registryId: string;
}

export class Scope extends Entity {
  name: string;
  registryId: string;

  constructor(data: ScopeData) {
    super(data);
    this.name = data.name;
    this.registryId = data.registryId;
  }

  static create(data: EasyData<ScopeData, 'scopeId'>): Scope {
    const newData = EntityUtil.defaultData(data, 'scopeId');
    return new Scope(newData);
  }
}
