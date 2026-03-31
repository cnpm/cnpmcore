import { EasyData, EntityUtil } from '../util/EntityUtil.ts';
import { Entity, EntityData } from './Entity.ts';

interface TeamMemberData extends EntityData {
  teamMemberId: string;
  teamId: string;
  userId: string;
}

export type CreateTeamMemberData = Omit<EasyData<TeamMemberData, 'teamMemberId'>, 'id'>;

export class TeamMember extends Entity {
  teamMemberId: string;
  teamId: string;
  userId: string;

  constructor(data: TeamMemberData) {
    super(data);
    this.teamMemberId = data.teamMemberId;
    this.teamId = data.teamId;
    this.userId = data.userId;
  }

  static create(data: CreateTeamMemberData): TeamMember {
    const newData = EntityUtil.defaultData(data, 'teamMemberId');
    return new TeamMember(newData);
  }
}
