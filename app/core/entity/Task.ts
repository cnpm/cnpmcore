import { Entity, EntityData } from './Entity';
import { EasyData, EntityUtil } from '../util/EntityUtil';
import { TaskType, TaskState } from '../../common/enum/Task';
import dayjs from '../../common/dayjs';

interface TaskData extends EntityData {
  taskId: string;
  type: TaskType;
  state: TaskState;
  authorId: string;
  authorIp: string;
  data: object;
  logPath?: string;
}

export class Task extends Entity {
  taskId: string;
  type: TaskType;
  state: TaskState;
  authorId: string;
  authorIp: string;
  data: object;
  logPath: string;

  constructor(data: TaskData) {
    super(data);
    this.taskId = data.taskId;
    this.type = data.type;
    this.state = data.state;
    this.authorId = data.authorId;
    this.authorIp = data.authorIp;
    this.data = data.data;
    this.logPath = data.logPath ?? '';
  }

  private static create(data: EasyData<TaskData, 'taskId'>): Task {
    const newData = EntityUtil.defaultData(data, 'taskId');
    return new Task(newData);
  }

  public static createSyncPackage(fullname: string, options = { authorId: '', authorIp: '' }): Task {
    const data = {
      ...options,
      type: TaskType.SyncPackage,
      state: TaskState.Waiting,
      data: { fullname },
    };
    const task = this.create(data);
    task.logPath = `/packages/${fullname}/syncs/${dayjs().format('YYYY/MM/DDHHMM')}-${task.taskId}.log`;
    return task;
  }
}
