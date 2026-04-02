import { AccessLevel, Inject, SingletonProto } from 'egg';

import { Team } from '../core/entity/Team.ts';
import { TeamMember } from '../core/entity/TeamMember.ts';
import { TeamPackage } from '../core/entity/TeamPackage.ts';
import { AbstractRepository } from './AbstractRepository.ts';
import { Team as TeamModel } from './model/Team.ts';
import { TeamMember as TeamMemberModel } from './model/TeamMember.ts';
import { TeamPackage as TeamPackageModel } from './model/TeamPackage.ts';
import { ModelConvertor } from './util/ModelConvertor.ts';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class TeamRepository extends AbstractRepository {
  @Inject()
  private readonly Team: typeof TeamModel;

  @Inject()
  private readonly TeamMember: typeof TeamMemberModel;

  @Inject()
  private readonly TeamPackage: typeof TeamPackageModel;

  // --- Team CRUD ---

  async findTeam(orgId: string, name: string): Promise<Team | null> {
    const model = await this.Team.findOne({ orgId, name });
    if (!model) return null;
    return ModelConvertor.convertModelToEntity(model, Team);
  }

  async findTeamByTeamId(teamId: string): Promise<Team | null> {
    const model = await this.Team.findOne({ teamId });
    if (!model) return null;
    return ModelConvertor.convertModelToEntity(model, Team);
  }

  async listTeamsByOrgId(orgId: string): Promise<Team[]> {
    const models = await this.Team.find({ orgId });
    return models.map((model) => ModelConvertor.convertModelToEntity(model, Team));
  }

  async saveTeam(team: Team): Promise<void> {
    if (team.id) {
      const model = await this.Team.findOne({ id: team.id });
      if (model) {
        await ModelConvertor.saveEntityToModel(team, model);
      }
      return;
    }
    await ModelConvertor.convertEntityToModel(team, this.Team);
  }

  async removeTeam(teamId: string): Promise<void> {
    await this.Team.remove({ teamId });
  }

  async removeAllTeamsByOrgId(orgId: string): Promise<void> {
    await this.Team.remove({ orgId });
  }

  async listTeamsByUserId(userId: string): Promise<Team[]> {
    const memberModels = await this.TeamMember.find({ userId });
    if (memberModels.length === 0) return [];
    const teamIds = memberModels.map((m) => m.teamId);
    const models = await this.Team.find({ teamId: { $in: teamIds } });
    return models.map((model) => ModelConvertor.convertModelToEntity(model, Team));
  }

  async listTeamsByUserIdAndOrgId(userId: string, orgId: string): Promise<{ team: Team; role: string }[]> {
    const orgTeams = await this.Team.find({ orgId });
    if (orgTeams.length === 0) return [];
    const orgTeamIds = orgTeams.map((t) => t.teamId);
    const memberModels = await this.TeamMember.find({ userId, teamId: { $in: orgTeamIds } });
    if (memberModels.length === 0) return [];
    const memberRoleMap = new Map(memberModels.map(m => [ m.teamId, m.role || 'member' ]));
    return orgTeams
      .filter((t) => memberRoleMap.has(t.teamId))
      .map((model) => ({
        team: ModelConvertor.convertModelToEntity(model, Team),
        role: memberRoleMap.get(model.teamId) || 'member',
      }));
  }

  // --- TeamMember ---

  async findMember(teamId: string, userId: string): Promise<TeamMember | null> {
    const model = await this.TeamMember.findOne({ teamId, userId });
    if (!model) return null;
    return ModelConvertor.convertModelToEntity(model, TeamMember);
  }

  async addMember(member: TeamMember): Promise<void> {
    if (member.id) {
      const model = await this.TeamMember.findOne({ id: member.id });
      if (model) {
        await ModelConvertor.saveEntityToModel(member, model);
      }
      return;
    }
    await ModelConvertor.convertEntityToModel(member, this.TeamMember);
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    await this.TeamMember.remove({ teamId, userId });
  }

  async removeMemberFromAllTeams(orgId: string, userId: string): Promise<void> {
    const teams = await this.Team.find({ orgId });
    if (teams.length === 0) return;
    const teamIds = teams.map((t) => t.teamId);
    await this.TeamMember.remove({ teamId: { $in: teamIds }, userId });
  }

  async listMembers(teamId: string): Promise<TeamMember[]> {
    const models = await this.TeamMember.find({ teamId });
    return models.map((model) => ModelConvertor.convertModelToEntity(model, TeamMember));
  }

  async removeAllMembersByTeamId(teamId: string): Promise<void> {
    await this.TeamMember.remove({ teamId });
  }

  async removeAllMembersByOrgId(orgId: string): Promise<void> {
    const teams = await this.Team.find({ orgId });
    if (teams.length === 0) return;
    const teamIds = teams.map((t) => t.teamId);
    await this.TeamMember.remove({ teamId: { $in: teamIds } });
  }

  // --- TeamPackage ---

  async findPackage(teamId: string, packageId: string): Promise<TeamPackage | null> {
    const model = await this.TeamPackage.findOne({ teamId, packageId });
    if (!model) return null;
    return ModelConvertor.convertModelToEntity(model, TeamPackage);
  }

  async addPackage(teamPackage: TeamPackage): Promise<void> {
    if (teamPackage.id) {
      return;
    }
    await ModelConvertor.convertEntityToModel(teamPackage, this.TeamPackage);
  }

  async removePackage(teamId: string, packageId: string): Promise<void> {
    await this.TeamPackage.remove({ teamId, packageId });
  }

  async listPackages(teamId: string): Promise<TeamPackage[]> {
    const models = await this.TeamPackage.find({ teamId });
    return models.map((model) => ModelConvertor.convertModelToEntity(model, TeamPackage));
  }

  async removeAllPackagesByTeamId(teamId: string): Promise<void> {
    await this.TeamPackage.remove({ teamId });
  }

  async removeTeamCascade(teamId: string): Promise<void> {
    await this.Team.transaction(async ({ connection }) => {
      await this.TeamPackage.remove({ teamId }, true, { connection });
      await this.TeamMember.remove({ teamId }, true, { connection });
      await this.Team.remove({ teamId }, true, { connection });
    });
  }

  async removeAllPackagesByOrgId(orgId: string): Promise<void> {
    const teams = await this.Team.find({ orgId });
    if (teams.length === 0) return;
    const teamIds = teams.map((t) => t.teamId);
    await this.TeamPackage.remove({ teamId: { $in: teamIds } });
  }

  async hasAnyTeamBinding(packageId: string): Promise<boolean> {
    const model = await this.TeamPackage.findOne({ packageId });
    return !!model;
  }

  // No JOIN: step 1 find teamIds by packageId, step 2 check membership
  async hasPackageAccess(packageId: string, userId: string): Promise<boolean> {
    const teamPackages = await this.TeamPackage.find({ packageId });
    if (teamPackages.length === 0) return false;
    const teamIds = teamPackages.map((tp) => tp.teamId);
    const member = await this.TeamMember.findOne({ teamId: { $in: teamIds }, userId });
    return !!member;
  }
}
