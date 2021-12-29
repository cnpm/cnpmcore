import {
  AccessLevel,
  ContextProto,
  Inject,
} from '@eggjs/tegg';
import { NFSAdapter } from '../../common/adapter/NFSAdapter';
import { TaskState, TaskType } from '../../common/enum/Task';
import { TaskRepository } from '../../repository/TaskRepository';
import { Task } from '../entity/Task';
import { AbstractService } from './AbstractService';

function isoNow() {
  return new Date().toISOString();
}

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class BinarySyncerService extends AbstractService {
  @Inject()
  private readonly taskRepository: TaskRepository;
  @Inject()
  private readonly nfsAdapter: NFSAdapter;

  public async createTask(binaryName: string) {
    const existsTask = await this.taskRepository.findTaskByTargetName(binaryName, TaskType.SyncBinary);
    if (existsTask) return existsTask;
    const task = Task.createSyncBinary(binaryName, options);
    await this.taskRepository.saveTask(task);
    this.logger.info('[BinarySyncerService.createTask:new] binaryName: %s, taskId: %s',
      binaryName, task.taskId);
    return task;
  }

  public async findTask(taskId: string) {
    const task = await this.taskRepository.findTask(taskId);
    return task;
  }

  public async findTaskLog(task: Task) {
    return await this.nfsAdapter.getDownloadUrlOrStream(task.logPath);
  }

  public async findExecuteTask() {
    const task = await this.taskRepository.executeWaitingTask(TaskType.SyncPackage);
    if (task && task.attempts > 3) {
      task.state = TaskState.Timeout;
      task.attempts -= 1;
      await this.taskRepository.saveTaskToHistory(task);
      return null;
    }
    return task;
  }
}
