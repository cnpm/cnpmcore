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
export class TaskService extends AbstractService {
  @Inject()
  private readonly taskRepository: TaskRepository;
  @Inject()
  private readonly nfsAdapter: NFSAdapter;

  public async findTask(taskId: string) {
    const task = await this.taskRepository.findTask(taskId);
    return task;
  }

  public async findTaskLog(task: Task) {
    return await this.nfsAdapter.getDownloadUrlOrStream(task.logPath);
  }

  public async findExecuteTask(taskType: TaskType) {
    // 10 mins timeout, binary fine maybe 100MB need 10 mins to download it.
    const task = await this.taskRepository.executeWaitingTask(taskType, 60000 * 10);
    if (task) {
      if (task.attempts > 3) {
        task.state = TaskState.Timeout;
        task.attempts -= 1;
        await this.taskRepository.saveTaskToHistory(task);
        return null;
      }
      if (task.attempts > 1) {
        // reset logPath
        task.resetLogPath();
      }
    }
    return task;
  }

  public async appendTaskLog(task: Task, appendLog: string) {
    // console.log(appendLog);
    const nextPosition = await this.nfsAdapter.appendBytes(
      task.logPath,
      Buffer.from(appendLog + '\n'),
      task.logStorePosition,
      {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    );
    if (nextPosition) {
      task.logStorePosition = nextPosition;
    }
    task.updatedAt = new Date();
    await this.taskRepository.saveTask(task);
  }

  public async finishTask(task: Task, taskState: TaskState, appendLog: string) {
    const nextPosition = await this.nfsAdapter.appendBytes(
      task.logPath,
      Buffer.from(appendLog + '\n'),
      task.logStorePosition,
      {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    );
    if (nextPosition) {
      task.logStorePosition = nextPosition;
    }
    task.state = taskState;
    await this.taskRepository.saveTaskToHistory(task);
  }
}
