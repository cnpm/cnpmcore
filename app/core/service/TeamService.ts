import { AccessLevel, Inject, SingletonProto } from 'egg';
import { ForbiddenError, NotFoundError } from 'egg/errors';

import { AbstractService } from '../../common/AbstractService.ts';
import { DEVELOPERS_TEAM } from '../../common/constants.ts';
import type { OrgRepository } from '../../repository/OrgRepository.ts';
import type { TeamRepository } from '../../repository/TeamRepository.ts';
import { Team } from '../entity/Team.ts';
import { TeamMember } from '../entity/TeamMember.ts';
import { TeamPackage } from '../entity/TeamPackage.ts';

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class TeamService extends AbstractService {
  @Inject()
  private readonly orgRepository: OrgRepository;

  @Inject()
  private readonly teamRepository: TeamRepository;

  async createTeam(orgId: string, name: string, description?: string): Promise<Team> {
    const existing = await this.teamRepository.findTeam(orgId, name);
    if (existing) {
      throw new ForbiddenError(`Team "${name}" already exists`);
    }

    const team = Team.create({
      orgId,
      name,
      description,
    });
    await this.teamRepository.saveTeam(team);
    this.logger.info('[TeamService:createTeam] teamId: %s, orgId: %s, name: %s', team.teamId, orgId, name);
    return team;
  }

  async removeTeam(teamId: string): Promise<void> {
    const team = await this.teamRepository.findTeamByTeamId(teamId);
    if (!team) {
      throw new NotFoundError('Team not found');
    }
    if (team.name === DEVELOPERS_TEAM) {
      throw new ForbiddenError('Cannot delete the developers team');
    }
    // Cascade: remove packages + members + team in one transaction
    await this.teamRepository.removeTeamCascade(teamId);
    this.logger.info('[TeamService:removeTeam] teamId: %s', teamId);
  }

  async addMember(teamId: string, userId: string): Promise<TeamMember> {
    const team = await this.teamRepository.findTeamByTeamId(teamId);
    if (!team) {
      throw new NotFoundError('Team not found');
    }

    // For allowScopes orgs, skip org member check (self-registry users have implicit access)
    // For other orgs, must be an org member first
    const org = await this.orgRepository.findOrgByOrgId(team.orgId);
    if (org && !this.config.cnpmcore.allowScopes.includes(`@${org.name}`)) {
      const orgMember = await this.orgRepository.findMember(team.orgId, userId);
      if (!orgMember) {
        throw new ForbiddenError('User must be an org member before joining a team');
      }
    }

    const existing = await this.teamRepository.findMember(teamId, userId);
    if (existing) {
      return existing;
    }

    const member = TeamMember.create({ teamId, userId });
    await this.teamRepository.addMember(member);
    this.logger.info('[TeamService:addMember] teamId: %s, userId: %s', teamId, userId);
    return member;
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    await this.teamRepository.removeMember(teamId, userId);
    this.logger.info('[TeamService:removeMember] teamId: %s, userId: %s', teamId, userId);
  }

  async listMembers(teamId: string): Promise<TeamMember[]> {
    return await this.teamRepository.listMembers(teamId);
  }

  async grantPackageAccess(teamId: string, packageId: string): Promise<TeamPackage> {
    const team = await this.teamRepository.findTeamByTeamId(teamId);
    if (!team) {
      throw new NotFoundError('Team not found');
    }

    const existing = await this.teamRepository.findPackage(teamId, packageId);
    if (existing) {
      return existing;
    }

    const teamPackage = TeamPackage.create({ teamId, packageId });
    await this.teamRepository.addPackage(teamPackage);
    this.logger.info('[TeamService:grantPackageAccess] teamId: %s, packageId: %s', teamId, packageId);
    return teamPackage;
  }

  async revokePackageAccess(teamId: string, packageId: string): Promise<void> {
    await this.teamRepository.removePackage(teamId, packageId);
    this.logger.info('[TeamService:revokePackageAccess] teamId: %s, packageId: %s', teamId, packageId);
  }

  async listPackages(teamId: string): Promise<TeamPackage[]> {
    return await this.teamRepository.listPackages(teamId);
  }
}
