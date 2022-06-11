import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  HTTPParam,
  HTTPBody,
  Context,
  EggContext,
  Inject,
  HTTPQuery,
} from '@eggjs/tegg';
import { ForbiddenError, NotFoundError } from 'egg-errors';
import { AbstractController } from './AbstractController';
import { FULLNAME_REG_STRING, getScopeAndName } from '../../common/PackageUtil';
import { Task } from '../../core/entity/Task';
import { PackageSyncerService } from '../../core/service/PackageSyncerService';
import { TaskState } from '../../common/enum/Task';
import { SyncPackageTaskRule, SyncPackageTaskType } from '../typebox';

@HTTPController()
export class PackageSyncController extends AbstractController {
  @Inject()
  private packageSyncerService: PackageSyncerService;

  private async _executeTaskAsync(task: Task) {
    const startTime = Date.now();
    this.logger.info('[PackageSyncController:executeTask:start] taskId: %s, targetName: %s, attempts: %s, params: %j, updatedAt: %s, delay %sms',
      task.taskId, task.targetName, task.attempts, task.data, task.updatedAt,
      startTime - task.updatedAt.getTime());
    let result = 'success';
    try {
      await this.packageSyncerService.executeTask(task);
    } catch (err) {
      result = 'error';
      this.logger.error(err);
    } finally {
      const use = Date.now() - startTime;
      this.logger.info('[PackageSyncController:executeTask:%s] taskId: %s, targetName: %s, use %sms',
        result, task.taskId, task.targetName, use);
    }
  }

  @HTTPMethod({
    // PUT /-/package/:fullname/syncs
    path: `/-/package/:fullname(${FULLNAME_REG_STRING})/syncs`,
    method: HTTPMethodEnum.PUT,
  })
  async createSyncTask(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPBody() data: SyncPackageTaskType) {
    if (!this.enableSyncAll) {
      throw new ForbiddenError('Not allow to sync package');
    }
    const tips = data.tips || `Sync cause by "${ctx.href}", parent traceId: ${ctx.tracer.traceId}`;
    const params = {
      fullname,
      tips,
      skipDependencies: !!data.skipDependencies,
      syncDownloadData: !!data.syncDownloadData,
      force: !!data.force,
    };
    ctx.tValidate(SyncPackageTaskRule, params);
    const [ scope, name ] = getScopeAndName(params.fullname);
    const packageEntity = await this.packageRepository.findPackage(scope, name);
    if (packageEntity?.isPrivate) {
      throw new ForbiddenError(`Can\'t sync private package "${params.fullname}"`);
    }
    if (params.syncDownloadData && !this.packageSyncerService.allowSyncDownloadData) {
      throw new ForbiddenError('Not allow to sync package download data');
    }
    const authorized = await this.userRoleManager.getAuthorizedUserAndToken(ctx);
    const task = await this.packageSyncerService.createTask(params.fullname, {
      authorIp: ctx.ip,
      authorId: authorized?.user.userId,
      tips: params.tips,
      skipDependencies: params.skipDependencies,
      syncDownloadData: params.syncDownloadData,
    });
    ctx.logger.info('[PackageSyncController.createSyncTask:success] taskId: %s, fullname: %s',
      task.taskId, fullname);
    if (data.force) {
      const isAdmin = await this.userRoleManager.isAdmin(ctx);
      if (isAdmin) {
        // execute task in background
        this._executeTaskAsync(task);
        ctx.logger.info('[PackageSyncController.createSyncTask:execute-immediately] taskId: %s',
          task.taskId);
      }
    }
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
  async showSyncTask(@HTTPParam() fullname: string, @HTTPParam() taskId: string) {
    const task = await this.packageSyncerService.findTask(taskId);
    if (!task) throw new NotFoundError(`Package "${fullname}" sync task "${taskId}" not found`);
    let logUrl: string | undefined;
    if (task.state !== TaskState.Waiting) {
      logUrl = `${this.config.cnpmcore.registry}/-/package/${fullname}/syncs/${taskId}/log`;
    }
    const error = task.error || undefined;
    return {
      ok: true,
      id: task.taskId,
      type: task.type,
      state: task.state,
      logUrl,
      error,
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

  // deprecate create sync task api for cnpmjs.org
  // https://github.com/cnpm/cnpmjs.org/blob/master/controllers/sync.js
  @HTTPMethod({
    // PUT /:fullname/sync
    path: `/:fullname(${FULLNAME_REG_STRING})/sync`,
    method: HTTPMethodEnum.PUT,
  })
  async deprecatedCreateSyncTask(@Context() ctx: EggContext, @HTTPParam() fullname: string, @HTTPQuery() nodeps: string) {
    const options: SyncPackageTaskType = {
      fullname,
      tips: `Sync cause by "${ctx.href}", parent traceId: ${ctx.tracer.traceId}`,
      skipDependencies: nodeps === 'true',
      syncDownloadData: false,
      force: false,
    };
    const task = await this.createSyncTask(ctx, fullname, options);
    return {
      ok: true,
      logId: task.id,
    };
  }

  // https://github.com/cnpm/cnpmjs.org/blob/master/controllers/sync.js#L55
  @HTTPMethod({
    // GET /:fullname/sync/log/:taskId
    path: `/:fullname(${FULLNAME_REG_STRING})/sync/log/:taskId`,
    method: HTTPMethodEnum.GET,
  })
  async deprecatedShowSyncTask(@HTTPParam() fullname: string, @HTTPParam() taskId: string) {
    const task = await this.showSyncTask(fullname, taskId);
    const syncDone = task.state !== TaskState.Waiting && task.state !== TaskState.Processing;
    const stateMessage = syncDone ? '[done]' : '[processing]';
    // https://github.com/cnpm/cnpm/blob/cadd3cd54c22b1a157810a43ab10febdb2410ca6/bin/cnpm-sync#L82
    const log = `[${new Date().toISOString()}] ${stateMessage} Sync ${fullname} data: ${JSON.stringify(task)}`;
    return {
      ok: true,
      syncDone,
      log,
      logUrl: task.logUrl,
      error: task.error,
    };
  }
}
