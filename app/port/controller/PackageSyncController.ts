import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  Context,
  EggContext,
  Inject,
} from '@eggjs/tegg';
import { ForbiddenError, NotFoundError } from 'egg-errors';
import { AbstractController } from './AbstractController';
import { FULLNAME_REG_STRING, getScopeAndName } from '../../common/PackageUtil';
import { PackageSyncerService } from '../../core/service/PackageSyncerService';
import { TaskState } from '../../common/enum/Task';

@HTTPController()
export class PackageSyncController extends AbstractController {
  @Inject()
  private packageSyncerService: PackageSyncerService;

  @HTTPMethod({
    // PUT /-/package/:fullname/syncs
    path: `/-/package/:fullname(${FULLNAME_REG_STRING})/syncs`,
    method: HTTPMethodEnum.PUT,
  })
  async createSyncTask(@Context() ctx: EggContext, @HTTPParam() fullname: string) {
    const [ scope, name ] = getScopeAndName(fullname);
    const packageEntity = await this.packageRepository.findPackage(scope, name);
    if (packageEntity?.isPrivate) {
      throw new ForbiddenError(`Can\'t sync private package "${fullname}"`);
    }
    const authorized = await this.userRoleManager.getAuthorizedUserAndToken(ctx);
    const task = await this.packageSyncerService.createTask(fullname, ctx.ip, authorized?.user.userId ?? '');
    ctx.status = 201;
    return {
      ok: true,
      id: task.taskId,
      type: task.type,
      state: task.state,
    };
  }

  // TODO: no-cache for CDN if task state is processing or timeout
  @HTTPMethod({
    // GET /-/package/:fullname/syncs/:syncId
    path: `/-/package/:fullname(${FULLNAME_REG_STRING})/syncs/:taskId`,
    method: HTTPMethodEnum.GET,
  })
  async showSyncTask(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPParam() taskId: string) {
    const task = await this.packageSyncerService.findTask(taskId);
    if (!task) throw new NotFoundError(`Package "${fullname}" sync task "${taskId}" not found`);
    let logUrl: URL | undefined;
    if (task.state !== TaskState.Waiting) {
      logUrl = new URL(ctx.href);
      logUrl.pathname = `${logUrl.pathname}/log`;
    }
    return {
      ok: true,
      id: task.taskId,
      type: task.type,
      state: task.state,
      logUrl: logUrl?.toString(),
    };
  }

  // TODO: no-cache for CDN if task state is processing or timeout
  @HTTPMethod({
    // GET /-/package/:fullname/syncs/:syncId/log
    path: `/-/package/:fullname(${FULLNAME_REG_STRING})/syncs/:taskId/log`,
    method: HTTPMethodEnum.GET,
  })
  async showSyncTaskLog(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPParam() taskId: string) {
    const task = await this.packageSyncerService.findTask(taskId);
    if (!task) throw new NotFoundError(`Package "${fullname}" sync task "${taskId}" not found`);
    if (task.state === TaskState.Waiting) throw new NotFoundError(`Package "${fullname}" sync task "${taskId}" log not found`);

    const logUrlOrStream = await this.packageSyncerService.findTaskLog(task);
    if (!logUrlOrStream) throw new NotFoundError(`Package "${fullname}" sync task "${taskId}" log not found`);
    if (typeof logUrlOrStream === 'string') {
      ctx.redirect(logUrlOrStream);
      return;
    }
    ctx.type = 'log';
    return logUrlOrStream;
  }
}
