import {
  AccessLevel,
  SingletonProto,
  Inject,
} from '@eggjs/tegg';
import { ForbiddenError, NotFoundError } from 'egg-errors';
import { AbstractService } from '../../common/AbstractService';
import { DEVELOPERS_TEAM } from '../../common/constants';
import { OrgRepository } from '../../repository/OrgRepository';
import { TeamRepository } from '../../repository/TeamRepository';
import { Org } from '../entity/Org';
import { OrgMember } from '../entity/OrgMember';
import { Team } from '../entity/Team';
import { TeamMember } from '../entity/TeamMember';

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

    // Create org
    const org = Org.create({
      name: cmd.name,
      description: cmd.description,
    });
    await this.orgRepository.saveOrg(org);

    // Create developers team
    const developersTeam = Team.create({
      orgId: org.orgId,
      name: DEVELOPERS_TEAM,
      description: 'default team',
    });
    await this.teamRepository.saveTeam(developersTeam);

    // Creator as owner + add to developers team
    const ownerMember = OrgMember.create({
      orgId: org.orgId,
      userId: cmd.creatorUserId,
      role: 'owner',
    });
    await this.orgRepository.saveMember(ownerMember);

    const teamMember = TeamMember.create({
      teamId: developersTeam.teamId,
      userId: cmd.creatorUserId,
    });
    await this.teamRepository.addMember(teamMember);

    this.logger.info('[OrgService:createOrg] orgId: %s, name: %s, creatorUserId: %s',
      org.orgId, org.name, cmd.creatorUserId);
    return org;
  }

  async removeOrg(orgId: string): Promise<void> {
    // Cascade: team_packages → team_members → teams → org_members → org
    await this.teamRepository.removeAllPackagesByOrgId(orgId);
    await this.teamRepository.removeAllMembersByOrgId(orgId);
    await this.teamRepository.removeAllTeamsByOrgId(orgId);
    await this.orgRepository.removeAllMembers(orgId);
    await this.orgRepository.removeOrg(orgId);
    this.logger.info('[OrgService:removeOrg] orgId: %s', orgId);
  }

  async findOrgByName(name: string): Promise<Org | null> {
    return await this.orgRepository.findOrgByName(name);
  }

  async addMember(orgId: string, userId: string, role: 'owner' | 'member' = 'member'): Promise<OrgMember> {
    const org = await this.orgRepository.findOrgByOrgId(orgId);
    if (!org) {
      throw new NotFoundError(`Org not found`);
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
