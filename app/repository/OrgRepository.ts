import { AccessLevel, Inject, SingletonProto } from 'egg';

import { Org } from '../core/entity/Org.ts';
import { OrgMember } from '../core/entity/OrgMember.ts';
import { Team } from '../core/entity/Team.ts';
import { TeamMember } from '../core/entity/TeamMember.ts';
import { AbstractRepository } from './AbstractRepository.ts';
import { Org as OrgModel } from './model/Org.ts';
import { OrgMember as OrgMemberModel } from './model/OrgMember.ts';
import { Team as TeamModel } from './model/Team.ts';
import { TeamMember as TeamMemberModel } from './model/TeamMember.ts';
import { TeamPackage as TeamPackageModel } from './model/TeamPackage.ts';
import { ModelConvertor } from './util/ModelConvertor.ts';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class OrgRepository extends AbstractRepository {
  @Inject()
  private readonly Org: typeof OrgModel;

  @Inject()
  private readonly OrgMember: typeof OrgMemberModel;

  @Inject()
  private readonly Team: typeof TeamModel;

  @Inject()
  private readonly TeamMember: typeof TeamMemberModel;

  @Inject()
  private readonly TeamPackage: typeof TeamPackageModel;

  async findOrgByName(name: string): Promise<Org | null> {
    const model = await this.Org.findOne({ name });
    if (!model) return null;
    return ModelConvertor.convertModelToEntity(model, Org);
  }

  async findOrgByOrgId(orgId: string): Promise<Org | null> {
    const model = await this.Org.findOne({ orgId });
    if (!model) return null;
    return ModelConvertor.convertModelToEntity(model, Org);
  }

  async saveOrg(org: Org): Promise<void> {
    if (org.id) {
      const model = await this.Org.findOne({ id: org.id });
      if (model) {
        await ModelConvertor.saveEntityToModel(org, model);
      }
      return;
    }
    await ModelConvertor.convertEntityToModel(org, this.Org);
  }

  async removeOrg(orgId: string): Promise<void> {
    await this.Org.remove({ orgId });
  }

  async findMember(orgId: string, userId: string): Promise<OrgMember | null> {
    const model = await this.OrgMember.findOne({ orgId, userId });
    if (!model) return null;
    return ModelConvertor.convertModelToEntity(model, OrgMember);
  }

  async saveMember(member: OrgMember): Promise<void> {
    if (member.id) {
      const model = await this.OrgMember.findOne({ id: member.id });
      if (model) {
        await ModelConvertor.saveEntityToModel(member, model);
      }
      return;
    }
    await ModelConvertor.convertEntityToModel(member, this.OrgMember);
  }

  async removeMember(orgId: string, userId: string): Promise<void> {
    await this.OrgMember.remove({ orgId, userId });
  }

  async listMembers(orgId: string): Promise<OrgMember[]> {
    const models = await this.OrgMember.find({ orgId });
    return models.map((model) => ModelConvertor.convertModelToEntity(model, OrgMember));
  }

  async removeAllMembers(orgId: string): Promise<void> {
    await this.OrgMember.remove({ orgId });
  }

  async createOrgCascade(
    org: Org,
    developersTeam: Team,
    ownerMember: OrgMember,
    teamMember: TeamMember,
  ): Promise<void> {
    await this.Org.transaction(async ({ connection }) => {
      await ModelConvertor.convertEntityToModel(org, this.Org, { connection });
      await ModelConvertor.convertEntityToModel(developersTeam, this.Team, { connection });
      await ModelConvertor.convertEntityToModel(ownerMember, this.OrgMember, { connection });
      await ModelConvertor.convertEntityToModel(teamMember, this.TeamMember, { connection });
    });
  }

  async removeOrgCascade(orgId: string): Promise<void> {
    const teams = await this.Team.find({ orgId });
    const teamIds = teams.map((t) => t.teamId);
    await this.Org.transaction(async ({ connection }) => {
      if (teamIds.length > 0) {
        await this.TeamPackage.remove({ teamId: { $in: teamIds } }, true, { connection });
        await this.TeamMember.remove({ teamId: { $in: teamIds } }, true, { connection });
      }
      await this.Team.remove({ orgId }, true, { connection });
      await this.OrgMember.remove({ orgId }, true, { connection });
      await this.Org.remove({ orgId }, true, { connection });
    });
  }
}
