import {
  Context,
  EggContext,
  HTTPBody,
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  Inject,
} from '@eggjs/tegg';
import { NotFoundError, UnprocessableEntityError } from 'egg-errors';
import { AbstractController } from './AbstractController';
import { OrgService } from '../../core/service/OrgService';
import { TeamService } from '../../core/service/TeamService';
import { TeamRepository } from '../../repository/TeamRepository';
import { getScopeAndName } from '../../common/PackageUtil';

@HTTPController()
export class TeamController extends AbstractController {
  @Inject()
  private readonly orgService: OrgService;

  @Inject()
  private readonly teamService: TeamService;

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

  private async requireOrgWriteAccess(ctx: EggContext, orgName: string) {
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

  private async requireTeamWriteAccess(ctx: EggContext, orgName: string, teamName: string) {
    const { org, authorizedUser } = await this.requireOrgWriteAccess(ctx, orgName);
    const team = await this.teamRepository.findTeam(org.orgId, teamName);
    if (!team) {
      throw new NotFoundError(`Team "${teamName}" not found`);
    }
    return { org, team, authorizedUser };
  }

  // --- Team CRUD ---

  // npm team create @scope:team → PUT /-/org/:orgName/team
  @HTTPMethod({
    path: '/-/org/:orgName/team',
    method: HTTPMethodEnum.PUT,
  })
  async createTeam(@Context() ctx: EggContext, @HTTPParam() orgName: string,
    @HTTPBody() body: { name: string; description?: string }) {
    const { org } = await this.requireOrgWriteAccess(ctx, orgName);

    if (!body.name) {
      throw new UnprocessableEntityError('name is required');
    }
    await this.teamService.createTeam(org.orgId, body.name, body.description);
    return { ok: true };
  }

  // npm team ls @scope → GET /-/org/:orgName/team
  @HTTPMethod({
    path: '/-/org/:orgName/team',
    method: HTTPMethodEnum.GET,
  })
  async listTeams(@Context() ctx: EggContext, @HTTPParam() orgName: string) {
    await this.userRoleManager.requiredAuthorizedUser(ctx, 'read');
    const org = await this.findOrg(orgName);
    if (!org) {
      throw new NotFoundError(`Org "${orgName}" not found`);
    }
    const teams = await this.teamRepository.listTeamsByOrgId(org.orgId);
    // npm CLI lsTeams expects ["@scope:teamname", ...] format
    return teams.map(t => `@${orgName}:${t.name}`);
  }

  // GET /-/team/:orgName/:teamName (npm compatible show)
  @HTTPMethod({
    path: '/-/team/:orgName/:teamName',
    method: HTTPMethodEnum.GET,
  })
  async showTeam(@Context() ctx: EggContext, @HTTPParam() orgName: string,
    @HTTPParam() teamName: string) {
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
  async removeTeam(@Context() ctx: EggContext, @HTTPParam() orgName: string,
    @HTTPParam() teamName: string) {
    const { team } = await this.requireTeamWriteAccess(ctx, orgName, teamName);
    await this.teamService.removeTeam(team.teamId);
    return { ok: true };
  }

  // --- Team Members (npm uses "user") ---

  // npm team ls @scope:team → GET /-/team/:orgName/:teamName/user
  @HTTPMethod({
    path: '/-/team/:orgName/:teamName/user',
    method: HTTPMethodEnum.GET,
  })
  async listTeamMembers(@Context() ctx: EggContext, @HTTPParam() orgName: string,
    @HTTPParam() teamName: string) {
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
    const users = await this.userRepository.findUsersByUserIds(members.map(m => m.userId));
    return users.map(u => u.displayName);
  }

  // npm team add <user> @scope:team → PUT /-/team/:orgName/:teamName/user
  @HTTPMethod({
    path: '/-/team/:orgName/:teamName/user',
    method: HTTPMethodEnum.PUT,
  })
  async addTeamMember(@Context() ctx: EggContext, @HTTPParam() orgName: string,
    @HTTPParam() teamName: string, @HTTPBody() body: { user: string }) {
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
  async removeTeamMember(@Context() ctx: EggContext, @HTTPParam() orgName: string,
    @HTTPParam() teamName: string, @HTTPBody() body: { user: string }) {
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
  async listTeamPackages(@Context() ctx: EggContext, @HTTPParam() orgName: string,
    @HTTPParam() teamName: string) {
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
    const pkgs = await this.packageRepository.findPackagesByPackageIds(teamPackages.map(tp => tp.packageId));
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
  async grantPackageAccess(@Context() ctx: EggContext, @HTTPParam() orgName: string,
    @HTTPParam() teamName: string, @HTTPBody() body: { package: string }) {
    const { team } = await this.requireTeamWriteAccess(ctx, orgName, teamName);
    if (!body.package) {
      throw new UnprocessableEntityError('package is required');
    }
    const [ scope, name ] = getScopeAndName(body.package);
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
  async revokePackageAccess(@Context() ctx: EggContext, @HTTPParam() orgName: string,
    @HTTPParam() teamName: string, @HTTPBody() body: { package: string }) {
    const { team } = await this.requireTeamWriteAccess(ctx, orgName, teamName);
    if (!body.package) {
      throw new UnprocessableEntityError('package is required');
    }
    const [ scope, name ] = getScopeAndName(body.package);
    const pkg = await this.packageRepository.findPackage(scope, name);
    if (!pkg) {
      throw new NotFoundError(`Package "${body.package}" not found`);
    }
    await this.teamService.revokePackageAccess(team.teamId, pkg.packageId);
    return { ok: true };
  }
}
