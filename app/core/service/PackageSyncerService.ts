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

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class PackageSyncerService extends AbstractService {
  @Inject()
  private readonly taskRepository: TaskRepository;
  @Inject()
  private readonly nfsAdapter: NFSAdapter;

  public async createTask(fullname: string, ip: string, userId: string) {
    const task = Task.createSyncPackage(fullname, { authorId: userId, authorIp: ip });
    await this.taskRepository.saveTask(task);
    return task;
  }

  public async findTask(taskId: string) {
    const task = await this.taskRepository.findTask(taskId);
    return task;
  }

  public async findTaskLog(task: Task) {
    return await this.nfsAdapter.getDownloadUrlOrStream(task.logPath);
  }

  public async executeTask() {
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
