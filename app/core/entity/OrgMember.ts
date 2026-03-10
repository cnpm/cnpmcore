import { Entity, EntityData } from './Entity';
import { EasyData, EntityUtil } from '../util/EntityUtil';

interface OrgMemberData extends EntityData {
  orgMemberId: string;
  orgId: string;
  userId: string;
  role: 'owner' | 'member';
}

export type CreateOrgMemberData = Omit<EasyData<OrgMemberData, 'orgMemberId'>, 'id'>;

export class OrgMember extends Entity {
  orgMemberId: string;
  orgId: string;
  userId: string;
  role: 'owner' | 'member';

  constructor(data: OrgMemberData) {
    super(data);
    this.orgMemberId = data.orgMemberId;
    this.orgId = data.orgId;
    this.userId = data.userId;
    this.role = data.role;
  }

  static create(data: CreateOrgMemberData): OrgMember {
    const newData = EntityUtil.defaultData(data, 'orgMemberId');
    return new OrgMember(newData);
  }
}
