import { EasyData, EntityUtil } from '../util/EntityUtil.ts';
import { Entity, EntityData } from './Entity.ts';

interface TeamPackageData extends EntityData {
  teamPackageId: string;
  teamId: string;
  packageId: string;
}

export type CreateTeamPackageData = Omit<EasyData<TeamPackageData, 'teamPackageId'>, 'id'>;

export class TeamPackage extends Entity {
  teamPackageId: string;
  teamId: string;
  packageId: string;

  constructor(data: TeamPackageData) {
    super(data);
    this.teamPackageId = data.teamPackageId;
    this.teamId = data.teamId;
    this.packageId = data.packageId;
  }

  static create(data: CreateTeamPackageData): TeamPackage {
    const newData = EntityUtil.defaultData(data, 'teamPackageId');
    return new TeamPackage(newData);
  }
}
