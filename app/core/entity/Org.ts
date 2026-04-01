import { EasyData, EntityUtil } from '../util/EntityUtil.ts';
import { Entity, EntityData } from './Entity.ts';

interface OrgData extends EntityData {
  orgId: string;
  name: string;
  description: string;
}

export type CreateOrgData = Omit<EasyData<OrgData, 'orgId'>, 'id' | 'description'> & { description?: string };

export class Org extends Entity {
  orgId: string;
  name: string;
  description: string;

  constructor(data: OrgData) {
    super(data);
    this.orgId = data.orgId;
    this.name = data.name;
    this.description = data.description ?? '';
  }

  static create(data: CreateOrgData): Org {
    const fullData = { ...data, description: data.description ?? '' };
    const newData = EntityUtil.defaultData(fullData, 'orgId');
    return new Org(newData);
  }
}
