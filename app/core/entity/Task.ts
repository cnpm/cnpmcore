import os from 'os';
import path from 'path';
import { Entity, EntityData } from './Entity';
import { EasyData, EntityUtil } from '../util/EntityUtil';
import { TaskType, TaskState } from '../../common/enum/Task';
import dayjs from '../../common/dayjs';
import { HookEvent } from './HookEvent';

const HOST_NAME = os.hostname();
const PID = process.pid;

export interface TaskBaseData {
  taskWorker: string;
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

export type SyncPackageTaskOptions = {
  authorId?: string;
  authorIp?: string;
  tips?: string;
  skipDependencies?: boolean;
  syncDownloadData?: boolean;
  // force sync history version
  forceSyncHistory?: boolean;
};

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
}

export interface ChangeStreamTaskData extends TaskBaseData {
  since: string;
  last_package?: string,
  last_package_created?: Date,
  task_count?: number,
  registryId?: string,
}

export type CreateHookTask = Task<CreateHookTaskData>;
export type TriggerHookTask = Task<TriggerHookTaskData>;
export type CreateSyncPackageTask = Task<CreateSyncPackageTaskData>;
export type ChangeStreamTask = Task<ChangeStreamTaskData>;

export class Task<T extends TaskBaseData = TaskBaseData> extends Entity {
  taskId: string;
  type: TaskType;
  state: TaskState;
  targetName: string;
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

  private static create<T extends TaskBaseData>(data: EasyData<TaskData<T>, 'taskId'>): Task<T> {
    const newData = EntityUtil.defaultData(data, 'taskId');
    return new Task(newData);
  }

  public static createSyncPackage(fullname: string, options?: SyncPackageTaskOptions): CreateSyncPackageTask {
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
        skipDependencies: options?.skipDependencies,
        syncDownloadData: options?.syncDownloadData,
        forceSyncHistory: options?.forceSyncHistory,
      },
    };
    const task = this.create(data);
    task.logPath = `/packages/${fullname}/syncs/${dayjs().format('YYYY/MM/DDHHmm')}-${task.taskId}.log`;
    return task;
  }

  public static createChangesStream(targetName: string): ChangeStreamTask {
    const data = {
      type: TaskType.ChangesStream,
      state: TaskState.Waiting,
      targetName,
      authorId: `pid_${PID}`,
      authorIp: HOST_NAME,
      data: {
        // task execute worker
        taskWorker: '',
        since: '',
      },
    };
    return this.create(data);
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

  public static createTriggerHookTask(hookEvent: HookEvent, hookId: string): TriggerHookTask {
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

  public static createSyncBinary(targetName: string, lastData: any): Task {
    const data = {
      type: TaskType.SyncBinary,
      state: TaskState.Waiting,
      targetName,
      authorId: `pid_${PID}`,
      authorIp: HOST_NAME,
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
}
