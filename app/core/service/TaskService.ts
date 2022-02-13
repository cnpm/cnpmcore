import {
  AccessLevel,
  ContextProto,
  Inject,
} from '@eggjs/tegg';
import { NFSAdapter } from '../../common/adapter/NFSAdapter';
import { TaskState, TaskType } from '../../common/enum/Task';
import { AbstractService } from '../../common/AbstractService';
import { TaskRepository } from '../../repository/TaskRepository';
import { Task } from '../entity/Task';

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

  public async findExecuteTask(taskType: TaskType, timeout?: number) {
    // 10 mins timeout, binary file maybe 100MB need 10 mins to download it.
    const task = await this.taskRepository.executeWaitingTask(taskType, timeout);
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
    await this.appendLogToNFS(task, appendLog);
    task.updatedAt = new Date();
    await this.taskRepository.saveTask(task);
  }

  public async finishTask(task: Task, taskState: TaskState, appendLog: string) {
    await this.appendLogToNFS(task, appendLog);
    task.state = taskState;
    await this.taskRepository.saveTaskToHistory(task);
  }

  public async retryTask(task: Task, appendLog: string) {
    await this.appendLogToNFS(task, appendLog);
    task.state = TaskState.Waiting;
    await this.taskRepository.saveTask(task);
  }

  private async appendLogToNFS(task: Task, appendLog: string) {
    try {
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
    } catch (err: any) {
      // [PositionNotEqualToLengthError]: Position is not equal to file length, status: 409
      // [ObjectNotAppendableError]: The object is not appendable
      if (err.code === 'PositionNotEqualToLength' || err.code === 'ObjectNotAppendable') {
        // override exists log file
        await this.nfsAdapter.uploadBytes(
          task.logPath,
          Buffer.from(appendLog + '\n'),
        );
        return;
      }
      throw err;
    }
  }
}
