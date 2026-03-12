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

  // --- Team CRUD ---

  // PUT /-/org/:orgName/team — create team
  @HTTPMethod({
    path: '/-/org/:orgName/team',
    method: HTTPMethodEnum.PUT,
  })
  async createTeam(@Context() ctx: EggContext, @HTTPParam() orgName: string,
    @HTTPBody() body: { name: string; description?: string }) {
    const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'setting');
    const org = await this.orgService.findOrgByName(orgName);
    if (!org) {
      throw new NotFoundError(`Org "${orgName}" not found`);
    }
    const isAdmin = await this.userRoleManager.isAdmin(ctx);
    await this.orgService.requiredOrgOwnerOrAdmin(org.orgId, authorizedUser.userId, isAdmin);

    if (!body.name) {
      throw new UnprocessableEntityError('name is required');
    }
    await this.teamService.createTeam(org.orgId, body.name, body.description);
    return { ok: true };
  }

  // GET /-/org/:orgName/team — list teams
  @HTTPMethod({
    path: '/-/org/:orgName/team',
    method: HTTPMethodEnum.GET,
  })
  async listTeams(@Context() ctx: EggContext, @HTTPParam() orgName: string) {
    await this.userRoleManager.requiredAuthorizedUser(ctx, 'read');
    const org = await this.orgService.findOrgByName(orgName);
    if (!org) {
      throw new NotFoundError(`Org "${orgName}" not found`);
    }
    const teams = await this.teamRepository.listTeamsByOrgId(org.orgId);
    return teams.map(t => ({ name: t.name, description: t.description }));
  }

  // GET /-/org/:orgName/team/:teamName
  @HTTPMethod({
    path: '/-/org/:orgName/team/:teamName',
    method: HTTPMethodEnum.GET,
  })
  async showTeam(@Context() ctx: EggContext, @HTTPParam() orgName: string,
    @HTTPParam() teamName: string) {
    await this.userRoleManager.requiredAuthorizedUser(ctx, 'read');
    const org = await this.orgService.findOrgByName(orgName);
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

  // DELETE /-/org/:orgName/team/:teamName
  @HTTPMethod({
    path: '/-/org/:orgName/team/:teamName',
    method: HTTPMethodEnum.DELETE,
  })
  async removeTeam(@Context() ctx: EggContext, @HTTPParam() orgName: string,
    @HTTPParam() teamName: string) {
    const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'setting');
    const org = await this.orgService.findOrgByName(orgName);
    if (!org) {
      throw new NotFoundError(`Org "${orgName}" not found`);
    }
    const isAdmin = await this.userRoleManager.isAdmin(ctx);
    await this.orgService.requiredOrgOwnerOrAdmin(org.orgId, authorizedUser.userId, isAdmin);

    const team = await this.teamRepository.findTeam(org.orgId, teamName);
    if (!team) {
      throw new NotFoundError(`Team "${teamName}" not found`);
    }
    await this.teamService.removeTeam(team.teamId);
    return { ok: true };
  }

  // --- Team Members ---

  // GET /-/org/:orgName/team/:teamName/member
  @HTTPMethod({
    path: '/-/org/:orgName/team/:teamName/member',
    method: HTTPMethodEnum.GET,
  })
  async listTeamMembers(@Context() ctx: EggContext, @HTTPParam() orgName: string,
    @HTTPParam() teamName: string) {
    await this.userRoleManager.requiredAuthorizedUser(ctx, 'read');
    const org = await this.orgService.findOrgByName(orgName);
    if (!org) {
      throw new NotFoundError(`Org "${orgName}" not found`);
    }
    const team = await this.teamRepository.findTeam(org.orgId, teamName);
    if (!team) {
      throw new NotFoundError(`Team "${teamName}" not found`);
    }
    const members = await this.teamService.listMembers(team.teamId);
    const users = await this.userRepository.findUsersByUserIds(members.map(m => m.userId));
    return users.map(u => u.name);
  }

  // PUT /-/org/:orgName/team/:teamName/member
  @HTTPMethod({
    path: '/-/org/:orgName/team/:teamName/member',
    method: HTTPMethodEnum.PUT,
  })
  async addTeamMember(@Context() ctx: EggContext, @HTTPParam() orgName: string,
    @HTTPParam() teamName: string, @HTTPBody() body: { user: string }) {
    const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'setting');
    const org = await this.orgService.findOrgByName(orgName);
    if (!org) {
      throw new NotFoundError(`Org "${orgName}" not found`);
    }
    const isAdmin = await this.userRoleManager.isAdmin(ctx);
    await this.orgService.requiredOrgOwnerOrAdmin(org.orgId, authorizedUser.userId, isAdmin);

    const team = await this.teamRepository.findTeam(org.orgId, teamName);
    if (!team) {
      throw new NotFoundError(`Team "${teamName}" not found`);
    }
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

  // DELETE /-/org/:orgName/team/:teamName/member/:username
  @HTTPMethod({
    path: '/-/org/:orgName/team/:teamName/member/:username',
    method: HTTPMethodEnum.DELETE,
  })
  async removeTeamMember(@Context() ctx: EggContext, @HTTPParam() orgName: string,
    @HTTPParam() teamName: string, @HTTPParam() username: string) {
    const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'setting');
    const org = await this.orgService.findOrgByName(orgName);
    if (!org) {
      throw new NotFoundError(`Org "${orgName}" not found`);
    }
    const isAdmin = await this.userRoleManager.isAdmin(ctx);
    await this.orgService.requiredOrgOwnerOrAdmin(org.orgId, authorizedUser.userId, isAdmin);

    const team = await this.teamRepository.findTeam(org.orgId, teamName);
    if (!team) {
      throw new NotFoundError(`Team "${teamName}" not found`);
    }
    const targetUser = await this.userRepository.findUserByName(username);
    if (!targetUser) {
      throw new NotFoundError(`User "${username}" not found`);
    }
    await this.teamService.removeMember(team.teamId, targetUser.userId);
    return { ok: true };
  }

  // --- Team Packages ---

  // GET /-/org/:orgName/team/:teamName/package
  @HTTPMethod({
    path: '/-/org/:orgName/team/:teamName/package',
    method: HTTPMethodEnum.GET,
  })
  async listTeamPackages(@Context() ctx: EggContext, @HTTPParam() orgName: string,
    @HTTPParam() teamName: string) {
    await this.userRoleManager.requiredAuthorizedUser(ctx, 'read');
    const org = await this.orgService.findOrgByName(orgName);
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

  // PUT /-/org/:orgName/team/:teamName/package — grant access
  @HTTPMethod({
    path: '/-/org/:orgName/team/:teamName/package',
    method: HTTPMethodEnum.PUT,
  })
  async grantPackageAccess(@Context() ctx: EggContext, @HTTPParam() orgName: string,
    @HTTPParam() teamName: string, @HTTPBody() body: { package: string }) {
    const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'setting');
    const org = await this.orgService.findOrgByName(orgName);
    if (!org) {
      throw new NotFoundError(`Org "${orgName}" not found`);
    }
    const isAdmin = await this.userRoleManager.isAdmin(ctx);
    await this.orgService.requiredOrgOwnerOrAdmin(org.orgId, authorizedUser.userId, isAdmin);

    const team = await this.teamRepository.findTeam(org.orgId, teamName);
    if (!team) {
      throw new NotFoundError(`Team "${teamName}" not found`);
    }
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

  // DELETE /-/org/:orgName/team/:teamName/package/@:scope/:name — revoke access
  @HTTPMethod({
    path: '/-/org/:orgName/team/:teamName/package/@:scope/:name',
    method: HTTPMethodEnum.DELETE,
  })
  async revokePackageAccess(@Context() ctx: EggContext, @HTTPParam() orgName: string,
    @HTTPParam() teamName: string, @HTTPParam() scope: string, @HTTPParam() name: string) {
    const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'setting');
    const org = await this.orgService.findOrgByName(orgName);
    if (!org) {
      throw new NotFoundError(`Org "${orgName}" not found`);
    }
    const isAdmin = await this.userRoleManager.isAdmin(ctx);
    await this.orgService.requiredOrgOwnerOrAdmin(org.orgId, authorizedUser.userId, isAdmin);

    const team = await this.teamRepository.findTeam(org.orgId, teamName);
    if (!team) {
      throw new NotFoundError(`Team "${teamName}" not found`);
    }
    const fullname = `@${scope}/${name}`;
    const pkg = await this.packageRepository.findPackage(`@${scope}`, name);
    if (!pkg) {
      throw new NotFoundError(`Package "${fullname}" not found`);
    }
    await this.teamService.revokePackageAccess(team.teamId, pkg.packageId);
    return { ok: true };
  }
}
