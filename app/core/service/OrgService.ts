import { AccessLevel, Inject, SingletonProto } from 'egg';
import { ForbiddenError, NotFoundError } from 'egg/errors';

import { AbstractService } from '../../common/AbstractService.ts';
import { DEVELOPERS_TEAM } from '../../common/constants.ts';
import type { OrgRepository } from '../../repository/OrgRepository.ts';
import type { TeamRepository } from '../../repository/TeamRepository.ts';
import { Org } from '../entity/Org.ts';
import { OrgMember } from '../entity/OrgMember.ts';
import { Team } from '../entity/Team.ts';
import { TeamMember } from '../entity/TeamMember.ts';

export interface CreateOrgCmd {
  name: string;
  description?: string;
  creatorUserId: string;
}

@SingletonProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class OrgService extends AbstractService {
  @Inject()
  private readonly orgRepository: OrgRepository;

  @Inject()
  private readonly teamRepository: TeamRepository;

  async createOrg(cmd: CreateOrgCmd): Promise<Org> {
    const existing = await this.orgRepository.findOrgByName(cmd.name);
    if (existing) {
      throw new ForbiddenError(`Org "${cmd.name}" already exists`);
    }

    // Create org + developers team + owner + team member in one transaction
    const org = Org.create({
      name: cmd.name,
      description: cmd.description,
    });
    const developersTeam = Team.create({
      orgId: org.orgId,
      name: DEVELOPERS_TEAM,
      description: 'default team',
    });
    const ownerMember = OrgMember.create({
      orgId: org.orgId,
      userId: cmd.creatorUserId,
      role: 'owner',
    });
    const teamMember = TeamMember.create({
      teamId: developersTeam.teamId,
      userId: cmd.creatorUserId,
    });
    await this.orgRepository.createOrgCascade(org, developersTeam, ownerMember, teamMember);

    this.logger.info(
      '[OrgService:createOrg] orgId: %s, name: %s, creatorUserId: %s',
      org.orgId,
      org.name,
      cmd.creatorUserId,
    );
    return org;
  }

  async removeOrg(orgId: string): Promise<void> {
    await this.orgRepository.removeOrgCascade(orgId);
    this.logger.info('[OrgService:removeOrg] orgId: %s', orgId);
  }

  async findOrgByName(name: string): Promise<Org | null> {
    return await this.orgRepository.findOrgByName(name);
  }

  // Auto-create org for allowScopes if it doesn't exist
  async ensureOrgForScope(scope: string): Promise<Org> {
    const orgName = scope.replace(/^@/, '');
    const existing = await this.orgRepository.findOrgByName(orgName);
    if (existing) return existing;

    const org = Org.create({
      name: orgName,
      description: `Auto-created org for scope ${scope}`,
    });
    await this.orgRepository.saveOrg(org);
    this.logger.info('[OrgService:ensureOrgForScope] orgId: %s, scope: %s', org.orgId, scope);
    return org;
  }

  async addMember(orgId: string, userId: string, role: 'owner' | 'member' = 'member'): Promise<OrgMember> {
    const org = await this.orgRepository.findOrgByOrgId(orgId);
    if (!org) {
      throw new NotFoundError('Org not found');
    }

    // Upsert org member
    let member = await this.orgRepository.findMember(orgId, userId);
    if (member) {
      member.role = role;
      await this.orgRepository.saveMember(member);
    } else {
      member = OrgMember.create({ orgId, userId, role });
      await this.orgRepository.saveMember(member);
    }

    // Auto-add to developers team
    const developersTeam = await this.teamRepository.findTeam(orgId, DEVELOPERS_TEAM);
    if (developersTeam) {
      const existingTeamMember = await this.teamRepository.findMember(developersTeam.teamId, userId);
      if (!existingTeamMember) {
        const teamMember = TeamMember.create({
          teamId: developersTeam.teamId,
          userId,
        });
        await this.teamRepository.addMember(teamMember);
      }
    }

    this.logger.info('[OrgService:addMember] orgId: %s, userId: %s, role: %s', orgId, userId, role);
    return member;
  }

  async removeMember(orgId: string, userId: string): Promise<void> {
    // Remove from all teams in this org
    await this.teamRepository.removeMemberFromAllTeams(orgId, userId);
    // Remove from org
    await this.orgRepository.removeMember(orgId, userId);
    this.logger.info('[OrgService:removeMember] orgId: %s, userId: %s', orgId, userId);
  }

  async listMembers(orgId: string): Promise<OrgMember[]> {
    return await this.orgRepository.listMembers(orgId);
  }

  async requiredOrgOwnerOrAdmin(orgId: string, userId: string, isAdmin: boolean): Promise<void> {
    if (isAdmin) return;
    const member = await this.orgRepository.findMember(orgId, userId);
    if (!member || member.role !== 'owner') {
      throw new ForbiddenError('Only org owner or admin can perform this action');
    }
  }
}
