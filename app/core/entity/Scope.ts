import { Entity, type EntityData } from './Entity.js';
import { EntityUtil, type EasyData } from '../util/EntityUtil.js';

interface ScopeData extends EntityData {
  name: string;
  scopeId: string;
  registryId: string;
}

export type CreateScopeData = Omit<EasyData<ScopeData, 'scopeId'>, 'id'>;

export class Scope extends Entity {
  name: string;
  registryId: string;
  scopeId: string;

  constructor(data: ScopeData) {
    super(data);
    this.name = data.name;
    this.registryId = data.registryId;
    this.scopeId = data.scopeId;
  }

  static create(data: CreateScopeData): Scope {
    const newData = EntityUtil.defaultData(data, 'scopeId');
    return new Scope(newData);
  }
}
