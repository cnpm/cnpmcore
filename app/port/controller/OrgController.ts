import {
  Context,
  EggContext,
  HTTPBody,
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  Inject,
  Middleware,
} from '@eggjs/tegg';
import { NotFoundError, UnprocessableEntityError } from 'egg-errors';
import pMap from 'p-map';
import { AbstractController } from './AbstractController';
import { AdminAccess } from '../middleware/AdminAccess';
import { OrgService } from '../../core/service/OrgService';
import { TeamRepository } from '../../repository/TeamRepository';

@HTTPController()
export class OrgController extends AbstractController {
  @Inject()
  private readonly orgService: OrgService;

  @Inject()
  private readonly teamRepository: TeamRepository;

  // PUT /-/org — Admin only
  @HTTPMethod({
    path: '/-/org',
    method: HTTPMethodEnum.PUT,
  })
  @Middleware(AdminAccess)
  async createOrg(@Context() ctx: EggContext, @HTTPBody() body: { name: string; description?: string }) {
    const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'setting');
    if (!body.name) {
      throw new UnprocessableEntityError('name is required');
    }
    await this.orgService.createOrg({
      name: body.name,
      description: body.description,
      creatorUserId: authorizedUser.userId,
    });
    return { ok: true };
  }

  // GET /-/org/:orgName
  @HTTPMethod({
    path: '/-/org/:orgName',
    method: HTTPMethodEnum.GET,
  })
  async showOrg(@Context() ctx: EggContext, @HTTPParam() orgName: string) {
    await this.userRoleManager.requiredAuthorizedUser(ctx, 'read');
    const org = await this.orgService.findOrgByName(orgName);
    if (!org) {
      throw new NotFoundError(`Org "${orgName}" not found`);
    }
    return {
      name: org.name,
      description: org.description,
      created: org.createdAt,
    };
  }

  // DELETE /-/org/:orgName — Admin only
  @HTTPMethod({
    path: '/-/org/:orgName',
    method: HTTPMethodEnum.DELETE,
  })
  @Middleware(AdminAccess)
  async removeOrg(@Context() ctx: EggContext, @HTTPParam() orgName: string) {
    await this.userRoleManager.requiredAuthorizedUser(ctx, 'setting');
    const org = await this.orgService.findOrgByName(orgName);
    if (!org) {
      throw new NotFoundError(`Org "${orgName}" not found`);
    }
    await this.orgService.removeOrg(org.orgId);
    return { ok: true };
  }

  // GET /-/org/:orgName/member — npm org ls
  @HTTPMethod({
    path: '/-/org/:orgName/member',
    method: HTTPMethodEnum.GET,
  })
  async listMembers(@Context() ctx: EggContext, @HTTPParam() orgName: string) {
    await this.userRoleManager.requiredAuthorizedUser(ctx, 'read');
    const org = await this.orgService.findOrgByName(orgName);
    if (!org) {
      throw new NotFoundError(`Org "${orgName}" not found`);
    }
    const members = await this.orgService.listMembers(org.orgId);
    const users = await pMap(members, m => this.userRepository.findUserByUserId(m.userId), { concurrency: 10 });
    const result: Record<string, string> = {};
    for (let i = 0; i < members.length; i++) {
      const user = users[i];
      if (user) {
        result[user.name] = members[i].role;
      }
    }
    return result;
  }

  // PUT /-/org/:orgName/member — npm org set
  @HTTPMethod({
    path: '/-/org/:orgName/member',
    method: HTTPMethodEnum.PUT,
  })
  async addMember(@Context() ctx: EggContext, @HTTPParam() orgName: string,
    @HTTPBody() body: { user: string; role?: 'owner' | 'member' }) {
    const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'setting');
    const org = await this.orgService.findOrgByName(orgName);
    if (!org) {
      throw new NotFoundError(`Org "${orgName}" not found`);
    }
    const isAdmin = await this.userRoleManager.isAdmin(ctx);
    await this.orgService.requiredOrgOwnerOrAdmin(org.orgId, authorizedUser.userId, isAdmin);

    if (!body.user) {
      throw new UnprocessableEntityError('user is required');
    }
    const targetUser = await this.userRepository.findUserByName(body.user);
    if (!targetUser) {
      throw new NotFoundError(`User "${body.user}" not found`);
    }
    await this.orgService.addMember(org.orgId, targetUser.userId, body.role || 'member');
    return { ok: true };
  }

  // DELETE /-/org/:orgName/member/:username — npm org rm
  @HTTPMethod({
    path: '/-/org/:orgName/member/:username',
    method: HTTPMethodEnum.DELETE,
  })
  async removeMember(@Context() ctx: EggContext, @HTTPParam() orgName: string,
    @HTTPParam() username: string) {
    const authorizedUser = await this.userRoleManager.requiredAuthorizedUser(ctx, 'setting');
    const org = await this.orgService.findOrgByName(orgName);
    if (!org) {
      throw new NotFoundError(`Org "${orgName}" not found`);
    }
    const isAdmin = await this.userRoleManager.isAdmin(ctx);
    await this.orgService.requiredOrgOwnerOrAdmin(org.orgId, authorizedUser.userId, isAdmin);

    const targetUser = await this.userRepository.findUserByName(username);
    if (!targetUser) {
      throw new NotFoundError(`User "${username}" not found`);
    }
    await this.orgService.removeMember(org.orgId, targetUser.userId);
    return { ok: true };
  }

  // GET /-/org/:orgName/member/:username/team
  @HTTPMethod({
    path: '/-/org/:orgName/member/:username/team',
    method: HTTPMethodEnum.GET,
  })
  async listUserTeams(@Context() ctx: EggContext, @HTTPParam() orgName: string,
    @HTTPParam() username: string) {
    await this.userRoleManager.requiredAuthorizedUser(ctx, 'read');
    const org = await this.orgService.findOrgByName(orgName);
    if (!org) {
      throw new NotFoundError(`Org "${orgName}" not found`);
    }
    const targetUser = await this.userRepository.findUserByName(username);
    if (!targetUser) {
      throw new NotFoundError(`User "${username}" not found`);
    }
    const teams = await this.teamRepository.listTeamsByUserId(targetUser.userId);
    const orgTeams = teams.filter(t => t.orgId === org.orgId);
    return orgTeams.map(t => ({ name: t.name, description: t.description }));
  }
}
