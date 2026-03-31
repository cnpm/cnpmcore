import { Entity, EntityData } from './Entity.ts';
import { EasyData, EntityUtil } from '../util/EntityUtil.ts';

interface TeamData extends EntityData {
  teamId: string;
  orgId: string;
  name: string;
  description: string;
}

export type CreateTeamData = Omit<EasyData<TeamData, 'teamId'>, 'id' | 'description'> & { description?: string };

export class Team extends Entity {
  teamId: string;
  orgId: string;
  name: string;
  description: string;

  constructor(data: TeamData) {
    super(data);
    this.teamId = data.teamId;
    this.orgId = data.orgId;
    this.name = data.name;
    this.description = data.description ?? '';
  }

  static create(data: CreateTeamData): Team {
    const fullData = { ...data, description: data.description ?? '' };
    const newData = EntityUtil.defaultData(fullData, 'teamId');
    return new Team(newData);
  }
}
