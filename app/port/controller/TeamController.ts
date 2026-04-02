import { Context, HTTPBody, HTTPContext, HTTPController, HTTPMethod, HTTPMethodEnum, HTTPParam, Inject } from 'egg';
import { ForbiddenError, NotFoundError, UnprocessableEntityError } from 'egg/errors';

import { getScopeAndName } from '../../common/PackageUtil.ts';
import type { OrgService } from '../../core/service/OrgService.ts';
import type { TeamService } from '../../core/service/TeamService.ts';
import type { OrgRepository } from '../../repository/OrgRepository.ts';
import type { TeamRepository } from '../../repository/TeamRepository.ts';
import { AbstractController } from './AbstractController.ts';

@HTTPController()
export class TeamController extends AbstractController {
  @Inject()
  private readonly orgService: OrgService;

  @Inject()
  private readonly teamService: TeamService;

  @Inject()
  private readonly orgRepository: OrgRepository;

  @Inject()
  private readonly teamRepository: TeamRepository;

  private isAllowScopeOrg(orgName: string): boolean {
    return this.config.cnpmcore.allowScopes.includes(`@${orgName}`);
  }

  // For allowScopes orgs, auto-ensure; for others, just look up
  private async findOrg(orgName: string) {
    if (this.isAllowScopeOrg(orgName)) {
      return await this.orgService.ensureOrgForScope(`@${orgName}`);
    }
    return await this.orgService.findOrgByName(orgName);
  }

  private async requireOrgWriteAccess(ctx: Context, orgName: string) {
    const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'setting');

    if (this.isAllowScopeOrg(orgName)) {
      // allowScopes org: any authenticated user can operate, auto-ensure org
      const org = await this.orgService.ensureOrgForScope(`@${orgName}`);
      return { org, authorizedUser };
    }

    // Non-allowScopes org: admin or org owner only
    const org = await this.orgService.findOrgByName(orgName);
    if (!org) {
      throw new NotFoundError(`Org "${orgName}" not found`);
    }
    const isAdmin = await this.userRoleManager.isAdmin(ctx);
    await this.orgService.requiredOrgOwnerOrAdmin(org.orgId, authorizedUser.userId, isAdmin);
    return { org, authorizedUser };
  }

  private async requireTeamWriteAccess(ctx: Context, orgName: string, teamName: string) {
    const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'setting');
    const isAdmin = await this.userRoleManager.isAdmin(ctx);

    let org;
    if (this.isAllowScopeOrg(orgName)) {
      org = await this.orgService.ensureOrgForScope(`@${orgName}`);
    } else {
      org = await this.orgService.findOrgByName(orgName);
      if (!org) {
        throw new NotFoundError(`Org "${orgName}" not found`);
      }
    }

    const team = await this.teamRepository.findTeam(org.orgId, teamName);
    if (!team) {
      throw new NotFoundError(`Team "${teamName}" not found`);
    }

    // Admin always has access
    if (isAdmin) {
      return { org, team, authorizedUser };
    }

    // Org owner has access
    if (!this.isAllowScopeOrg(orgName)) {
      const orgMember = await this.orgRepository.findMember(org.orgId, authorizedUser.userId);
      if (orgMember && orgMember.role === 'owner') {
        return { org, team, authorizedUser };
      }
    }

    // Team owner has access
    const teamMember = await this.teamRepository.findMember(team.teamId, authorizedUser.userId);
    if (teamMember && teamMember.role === 'owner') {
      return { org, team, authorizedUser };
    }

    throw new ForbiddenError('Only team owner or admin can perform this action');
  }

  // --- Team CRUD ---

  // npm team create @scope:team → PUT /-/org/:orgName/team
  @HTTPMethod({
    path: '/-/org/:orgName/team',
    method: HTTPMethodEnum.PUT,
  })
  async createTeam(
    @HTTPContext() ctx: Context,
    @HTTPParam() orgName: string,
    @HTTPBody() body: { name: string; description?: string },
  ) {
    const { org, authorizedUser } = await this.requireOrgWriteAccess(ctx, orgName);

    if (!body.name) {
      throw new UnprocessableEntityError('name is required');
    }
    await this.teamService.createTeam(org.orgId, body.name, body.description, authorizedUser.userId);
    return { ok: true };
  }

  // npm team ls @scope → GET /-/org/:orgName/team
  @HTTPMethod({
    path: '/-/org/:orgName/team',
    method: HTTPMethodEnum.GET,
  })
  async listTeams(@HTTPContext() ctx: Context, @HTTPParam() orgName: string) {
    await this.userRoleManager.requiredAuthorizedUser(ctx, 'read');
    const org = await this.findOrg(orgName);
    if (!org) {
      throw new NotFoundError(`Org "${orgName}" not found`);
    }
    const teams = await this.teamRepository.listTeamsByOrgId(org.orgId);
    // npm CLI adds @ prefix itself, return "scope:teamname" format
    return teams.map((t) => `${orgName}:${t.name}`);
  }

  // GET /-/team/:orgName/:teamName (npm compatible show)
  @HTTPMethod({
    path: '/-/team/:orgName/:teamName',
    method: HTTPMethodEnum.GET,
  })
  async showTeam(@HTTPContext() ctx: Context, @HTTPParam() orgName: string, @HTTPParam() teamName: string) {
    await this.userRoleManager.requiredAuthorizedUser(ctx, 'read');
    const org = await this.findOrg(orgName);
    if (!org) {
      throw new NotFoundError(`Org "${orgName}" not found`);
    }
    const team = await this.teamRepository.findTeam(org.orgId, teamName);
    if (!team) {
      throw new NotFoundError(`Team "${teamName}" not found`);
    }
    return {
      name: team.name,
      description: team.description,
      created: team.createdAt,
    };
  }

  // npm team destroy @scope:team → DELETE /-/team/:orgName/:teamName
  @HTTPMethod({
    path: '/-/team/:orgName/:teamName',
    method: HTTPMethodEnum.DELETE,
  })
  async removeTeam(@HTTPContext() ctx: Context, @HTTPParam() orgName: string, @HTTPParam() teamName: string) {
    const { team } = await this.requireTeamWriteAccess(ctx, orgName, teamName);
    await this.teamService.removeTeam(team.teamId);
    return { ok: true };
  }

  // --- Team Members (npm uses "user") ---

  // npm team ls @scope:team → GET /-/team/:orgName/:teamName/user
  // npm compatible: returns string array ["user1", "user2"]
  @HTTPMethod({
    path: '/-/team/:orgName/:teamName/user',
    method: HTTPMethodEnum.GET,
  })
  async listTeamMembers(@HTTPContext() ctx: Context, @HTTPParam() orgName: string, @HTTPParam() teamName: string) {
    await this.userRoleManager.requiredAuthorizedUser(ctx, 'read');
    const org = await this.findOrg(orgName);
    if (!org) {
      throw new NotFoundError(`Org "${orgName}" not found`);
    }
    const team = await this.teamRepository.findTeam(org.orgId, teamName);
    if (!team) {
      throw new NotFoundError(`Team "${teamName}" not found`);
    }
    const members = await this.teamService.listMembers(team.teamId);
    const users = await this.userRepository.findUsersByUserIds(members.map((m) => m.userId));
    return users.map((u) => u.displayName);
  }

  // Private API: GET /-/team/:orgName/:teamName/member
  // Returns [{user, role}] with team member role info
  @HTTPMethod({
    path: '/-/team/:orgName/:teamName/member',
    method: HTTPMethodEnum.GET,
  })
  async listTeamMembersWithRole(
    @HTTPContext() ctx: Context,
    @HTTPParam() orgName: string,
    @HTTPParam() teamName: string,
  ) {
    await this.userRoleManager.requiredAuthorizedUser(ctx, 'read');
    const org = await this.findOrg(orgName);
    if (!org) {
      throw new NotFoundError(`Org "${orgName}" not found`);
    }
    const team = await this.teamRepository.findTeam(org.orgId, teamName);
    if (!team) {
      throw new NotFoundError(`Team "${teamName}" not found`);
    }
    const members = await this.teamService.listMembers(team.teamId);
    const users = await this.userRepository.findUsersByUserIds(members.map((m) => m.userId));
    const userMap = new Map(users.map((u) => [u.userId, u]));
    return members.map((m) => ({
      user: userMap.get(m.userId)?.displayName ?? '',
      role: m.role,
    }));
  }

  // Private API: PATCH /-/team/:orgName/:teamName/member/:username
  // Update team member role
  @HTTPMethod({
    path: '/-/team/:orgName/:teamName/member/:username',
    method: HTTPMethodEnum.PATCH,
  })
  async updateTeamMemberRole(
    @HTTPContext() ctx: Context,
    @HTTPParam() orgName: string,
    @HTTPParam() teamName: string,
    @HTTPParam() username: string,
    @HTTPBody() body: { role: string },
  ) {
    const { team } = await this.requireTeamWriteAccess(ctx, orgName, teamName);
    if (!body.role || (body.role !== 'owner' && body.role !== 'member')) {
      throw new UnprocessableEntityError('role is required and must be "owner" or "member"');
    }
    const targetUser = await this.userRepository.findUserByName(username);
    if (!targetUser) {
      throw new NotFoundError(`User "${username}" not found`);
    }
    const member = await this.teamRepository.findMember(team.teamId, targetUser.userId);
    if (!member) {
      throw new NotFoundError(`User "${username}" is not a member of this team`);
    }
    await this.teamService.addMember(team.teamId, targetUser.userId, body.role as 'owner' | 'member');
    return { ok: true };
  }

  // npm team add <user> @scope:team → PUT /-/team/:orgName/:teamName/user
  @HTTPMethod({
    path: '/-/team/:orgName/:teamName/user',
    method: HTTPMethodEnum.PUT,
  })
  async addTeamMember(
    @HTTPContext() ctx: Context,
    @HTTPParam() orgName: string,
    @HTTPParam() teamName: string,
    @HTTPBody() body: { user: string },
  ) {
    const { team } = await this.requireTeamWriteAccess(ctx, orgName, teamName);
    if (!body.user) {
      throw new UnprocessableEntityError('user is required');
    }
    const targetUser = await this.userRepository.findUserByName(body.user);
    if (!targetUser) {
      throw new NotFoundError(`User "${body.user}" not found`);
    }
    await this.teamService.addMember(team.teamId, targetUser.userId);
    return { ok: true };
  }

  // npm team rm <user> @scope:team → DELETE /-/team/:orgName/:teamName/user body:{user}
  @HTTPMethod({
    path: '/-/team/:orgName/:teamName/user',
    method: HTTPMethodEnum.DELETE,
  })
  async removeTeamMember(
    @HTTPContext() ctx: Context,
    @HTTPParam() orgName: string,
    @HTTPParam() teamName: string,
    @HTTPBody() body: { user: string },
  ) {
    const { team } = await this.requireTeamWriteAccess(ctx, orgName, teamName);
    if (!body.user) {
      throw new UnprocessableEntityError('user is required');
    }
    const targetUser = await this.userRepository.findUserByName(body.user);
    if (!targetUser) {
      throw new NotFoundError(`User "${body.user}" not found`);
    }
    await this.teamService.removeMember(team.teamId, targetUser.userId);
    return { ok: true };
  }

  // --- Team Packages ---

  // npm access ls-packages @scope:team → GET /-/team/:orgName/:teamName/package
  @HTTPMethod({
    path: '/-/team/:orgName/:teamName/package',
    method: HTTPMethodEnum.GET,
  })
  async listTeamPackages(@HTTPContext() ctx: Context, @HTTPParam() orgName: string, @HTTPParam() teamName: string) {
    await this.userRoleManager.requiredAuthorizedUser(ctx, 'read');
    const org = await this.findOrg(orgName);
    if (!org) {
      throw new NotFoundError(`Org "${orgName}" not found`);
    }
    const team = await this.teamRepository.findTeam(org.orgId, teamName);
    if (!team) {
      throw new NotFoundError(`Team "${teamName}" not found`);
    }
    const teamPackages = await this.teamService.listPackages(team.teamId);
    const pkgs = await this.packageRepository.findPackagesByPackageIds(teamPackages.map((tp) => tp.packageId));
    const result: Record<string, string> = {};
    for (const pkg of pkgs) {
      result[pkg.fullname] = 'read';
    }
    return result;
  }

  // npm access grant read-only @scope:team <pkg> → PUT /-/team/:orgName/:teamName/package
  @HTTPMethod({
    path: '/-/team/:orgName/:teamName/package',
    method: HTTPMethodEnum.PUT,
  })
  async grantPackageAccess(
    @HTTPContext() ctx: Context,
    @HTTPParam() orgName: string,
    @HTTPParam() teamName: string,
    @HTTPBody() body: { package: string },
  ) {
    const { team } = await this.requireTeamWriteAccess(ctx, orgName, teamName);
    if (!body.package) {
      throw new UnprocessableEntityError('package is required');
    }
    const [scope, name] = getScopeAndName(body.package);
    const pkg = await this.packageRepository.findPackage(scope, name);
    if (!pkg) {
      throw new NotFoundError(`Package "${body.package}" not found`);
    }
    await this.teamService.grantPackageAccess(team.teamId, pkg.packageId);
    return { ok: true };
  }

  // npm access revoke @scope:team <pkg> → DELETE /-/team/:orgName/:teamName/package body:{package}
  @HTTPMethod({
    path: '/-/team/:orgName/:teamName/package',
    method: HTTPMethodEnum.DELETE,
  })
  async revokePackageAccess(
    @HTTPContext() ctx: Context,
    @HTTPParam() orgName: string,
    @HTTPParam() teamName: string,
    @HTTPBody() body: { package: string },
  ) {
    const { team } = await this.requireTeamWriteAccess(ctx, orgName, teamName);
    if (!body.package) {
      throw new UnprocessableEntityError('package is required');
    }
    const [scope, name] = getScopeAndName(body.package);
    const pkg = await this.packageRepository.findPackage(scope, name);
    if (!pkg) {
      throw new NotFoundError(`Package "${body.package}" not found`);
    }
    await this.teamService.revokePackageAccess(team.teamId, pkg.packageId);
    return { ok: true };
  }
}
