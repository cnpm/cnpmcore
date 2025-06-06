import os from 'node:os';
import path from 'node:path';

import { InternalServerError } from 'egg-errors';

import { Entity, type EntityData } from './Entity.js';
import { EntityUtil, type EasyData } from '../util/EntityUtil.js';
import { TaskState, TaskType } from '../../common/enum/Task.js';
import { PROXY_CACHE_DIR_NAME } from '../../common/constants.js';
import dayjs from '../../common/dayjs.js';
import type { HookEvent } from './HookEvent.js';
import { isPkgManifest, type DIST_NAMES } from './Package.js';

export const HOST_NAME = os.hostname();
export const PID = process.pid;

export interface TaskBaseData {
  taskWorker: string;
  shouldNotMerge?: boolean;
}

export interface TaskData<T = TaskBaseData> extends EntityData {
  taskId: string;
  type: TaskType;
  state: TaskState;
  targetName: string;
  authorId: string;
  authorIp: string;
  data: T;
  logPath?: string;
  logStorePosition?: string;
  attempts?: number;
  error?: string;
  bizId?: string;
}

export interface SyncPackageTaskOptions {
  authorId?: string;
  authorIp?: string;
  tips?: string;
  skipDependencies?: boolean;
  syncDownloadData?: boolean;
  // force sync history version
  forceSyncHistory?: boolean;
  registryId?: string;
  specificVersions?: string[];
}

export interface UpdateProxyCacheTaskOptions {
  fullname: string;
  version?: string;
  fileType: DIST_NAMES;
}

export interface CreateHookTaskData extends TaskBaseData {
  hookEvent: HookEvent;
}

export interface TriggerHookTaskData extends TaskBaseData {
  hookEvent: HookEvent;
  hookId: string;
  responseStatus?: number;
}

export interface CreateSyncPackageTaskData extends TaskBaseData {
  tips?: string;
  skipDependencies?: boolean;
  syncDownloadData?: boolean;
  forceSyncHistory?: boolean;
  specificVersions?: string[];
}

export interface CreateUpdateProxyCacheTaskData extends TaskBaseData {
  fullname: string;
  version?: string;
  fileType: DIST_NAMES;
  filePath: string;
}

export type SyncBinaryTaskData = Record<string, unknown> & TaskBaseData;

export interface ChangesStreamTaskData extends TaskBaseData {
  since: string;
  last_package?: string;
  last_package_created?: Date;
  task_count?: number;
  registryId?: string;
}

export interface TaskUpdateCondition {
  taskId: string;
  attempts: number;
}

export type CreateHookTask = Task<CreateHookTaskData>;
export type TriggerHookTask = Task<TriggerHookTaskData>;
export type CreateSyncPackageTask = Task<CreateSyncPackageTaskData>;
export type ChangesStreamTask = Task<ChangesStreamTaskData>;
export type CreateUpdateProxyCacheTask = Task<CreateUpdateProxyCacheTaskData>;
export type SyncBinaryTask = Task<SyncBinaryTaskData>;

export class Task<T extends TaskBaseData = TaskBaseData> extends Entity {
  taskId: string;
  type: TaskType;
  state: TaskState;
  targetName: string;
  taskWorker: string;
  authorId: string;
  authorIp: string;
  data: T;
  logPath: string;
  logStorePosition: string;
  attempts: number;
  error: string;
  bizId?: string;

  constructor(data: TaskData<T>) {
    super(data);
    this.taskId = data.taskId;
    this.type = data.type;
    this.state = data.state;
    this.targetName = data.targetName;
    this.authorId = data.authorId;
    this.authorIp = data.authorIp;
    this.data = data.data;
    this.logPath = data.logPath ?? '';
    this.logStorePosition = data.logStorePosition ?? '';
    this.attempts = data.attempts ?? 0;
    this.error = data.error ?? '';
    this.bizId = data.bizId;
  }

  public resetLogPath() {
    this.logPath = `${path.dirname(this.logPath)}/${dayjs().format('DDHHmm')}-${this.taskId}-${this.attempts}.log`;
    this.logStorePosition = '';
  }

  public setExecuteWorker() {
    this.data.taskWorker = `${HOST_NAME}:${PID}`;
  }

  private static create<T extends TaskBaseData>(
    data: EasyData<TaskData<T>, 'taskId'>
  ): Task<T> {
    const newData = EntityUtil.defaultData(data, 'taskId');
    return new Task(newData);
  }

  public static createSyncPackage(
    fullname: string,
    options?: SyncPackageTaskOptions
  ): CreateSyncPackageTask {
    const data = {
      type: TaskType.SyncPackage,
      state: TaskState.Waiting,
      targetName: fullname,
      authorId: options?.authorId ?? '',
      authorIp: options?.authorIp ?? '',
      data: {
        // task execute worker
        taskWorker: '',
        tips: options?.tips,
        registryId: options?.registryId ?? '',
        skipDependencies: options?.skipDependencies,
        syncDownloadData: options?.syncDownloadData,
        forceSyncHistory: options?.forceSyncHistory,
        specificVersions: options?.specificVersions,
      },
    };
    const task = this.create(data);
    task.logPath = `/packages/${fullname}/syncs/${dayjs().format('YYYY/MM/DDHHmm')}-${task.taskId}.log`;
    return task;
  }

  public static createChangesStream(
    targetName: string,
    registryId = '',
    since = ''
  ): ChangesStreamTask {
    const data = {
      type: TaskType.ChangesStream,
      state: TaskState.Waiting,
      targetName,
      authorId: `pid_${PID}`,
      authorIp: HOST_NAME,
      data: {
        // task execute worker
        taskWorker: '',
        registryId,
        since,
      },
    };
    return this.create(data) as ChangesStreamTask;
  }

  public updateSyncData({ lastSince, taskCount, lastPackage }: SyncInfo) {
    const syncData = this.data as unknown as ChangesStreamTaskData;
    // 更新任务记录信息
    syncData.since = lastSince;
    syncData.task_count = (syncData.task_count || 0) + taskCount;

    if (taskCount > 0) {
      syncData.last_package = lastPackage;
      syncData.last_package_created = new Date();
    }
  }

  public static createCreateHookTask(hookEvent: HookEvent): CreateHookTask {
    const data = {
      type: TaskType.CreateHook,
      state: TaskState.Waiting,
      targetName: hookEvent.fullname,
      authorId: `pid_${process.pid}`,
      authorIp: os.hostname(),
      bizId: `CreateHook:${hookEvent.changeId}`,
      data: {
        // task execute worker
        taskWorker: '',
        hookEvent,
      },
    };
    const task = this.create(data);
    task.logPath = `/packages/${hookEvent.fullname}/hooks/${dayjs().format('YYYY/MM/DDHHmm')}-${task.taskId}.log`;
    return task;
  }

  public static createTriggerHookTask(
    hookEvent: HookEvent,
    hookId: string
  ): TriggerHookTask {
    const data = {
      type: TaskType.TriggerHook,
      state: TaskState.Waiting,
      targetName: hookEvent.fullname,
      authorId: `pid_${process.pid}`,
      bizId: `TriggerHook:${hookEvent.changeId}:${hookId}`,
      authorIp: os.hostname(),
      data: {
        // task execute worker
        taskWorker: '',
        hookEvent,
        hookId,
      },
    };
    const task = this.create(data);
    task.logPath = `/packages/${hookEvent.fullname}/hooks/${dayjs().format('YYYY/MM/DDHHmm')}-${task.taskId}.log`;
    return task;
  }

  public static createSyncBinary(
    targetName: string,
    lastData?: Record<string, unknown>
  ): Task {
    const data = {
      type: TaskType.SyncBinary,
      state: TaskState.Waiting,
      targetName,
      authorId: `pid_${PID}`,
      authorIp: HOST_NAME,
      bizId: `SyncBinary:${targetName}`,
      data: {
        // task execute worker
        taskWorker: '',
        ...lastData,
      },
    };
    const task = this.create(data);
    task.logPath = `/binaries/${targetName}/syncs/${dayjs().format('YYYY/MM/DDHHmm')}-${task.taskId}.log`;
    return task;
  }

  needMergeWhenWaiting(): boolean {
    // 历史任务补偿时，将 shouldNotMerge 设置为 true，避免合并
    // 补偿任务单独执行
    if (this.data.shouldNotMerge === true) {
      return false;
    }
    // 仅合并二进制镜像与 npm 包
    return [TaskType.SyncBinary, TaskType.SyncPackage].includes(this.type);
  }

  public static createUpdateProxyCache(
    targetName: string,
    options: UpdateProxyCacheTaskOptions
  ): CreateUpdateProxyCacheTask {
    if (!isPkgManifest(options.fileType)) {
      throw new InternalServerError(
        'should not update package version manifest.'
      );
    }
    const filePath = `/${PROXY_CACHE_DIR_NAME}/${options.fullname}/${options.fileType}`;
    const data = {
      type: TaskType.UpdateProxyCache,
      state: TaskState.Waiting,
      targetName,
      authorId: `pid_${PID}`,
      authorIp: HOST_NAME,
      data: {
        taskWorker: '',
        fullname: options.fullname,
        version: options?.version,
        fileType: options.fileType,
        filePath,
      },
    };
    const task = this.create(data);
    task.logPath = `/${PROXY_CACHE_DIR_NAME}/${options.fullname}/update-manifest-log/${options.fileType.split('.json')[0]}-${dayjs().format('YYYY/MM/DDHHmm')}-${task.taskId}.log`;
    return task;
  }

  start(): TaskUpdateCondition {
    const condition = {
      taskId: this.taskId,
      attempts: this.attempts,
    };
    this.setExecuteWorker();
    this.state = TaskState.Processing;
    this.attempts += 1;
    return condition;
  }
}

export interface SyncInfo {
  lastSince: string;
  taskCount: number;
  lastPackage?: string;
}
