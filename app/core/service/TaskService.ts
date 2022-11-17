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
import { QueueAdapter } from '../../common/typing';

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class TaskService extends AbstractService {
  @Inject()
  private readonly taskRepository: TaskRepository;
  @Inject()
  private readonly nfsAdapter: NFSAdapter;
  @Inject()
  private readonly queueAdapter: QueueAdapter;

  public async getTaskQueueLength(taskType: TaskType) {
    return await this.queueAdapter.length(taskType);
  }

  public async createTask(task: Task, addTaskQueueOnExists: boolean) {
    const existsTask = await this.taskRepository.findTaskByTargetName(task.targetName, task.type);
    if (existsTask) {
      // 如果任务还未被触发，就不继续重复创建
      // 如果任务正在执行，可能任务状态已更新，这种情况需要继续创建
      if (existsTask.state === TaskState.Waiting) {
        // 提高任务的优先级
        if (addTaskQueueOnExists) {
          const queueLength = await this.getTaskQueueLength(task.type);
          if (queueLength < this.config.cnpmcore.taskQueueHighWaterSize) {
            // make sure waiting task in queue
            await this.queueAdapter.push<string>(task.type, existsTask.taskId);
            this.logger.info('[TaskService.createTask:exists-to-queue] taskType: %s, targetName: %s, taskId: %s, queue size: %s',
              task.type, task.targetName, task.taskId, queueLength);
          }
        }
        return existsTask;
      }
    }
    await this.taskRepository.saveTask(task);
    await this.queueAdapter.push<string>(task.type, task.taskId);
    const queueLength = await this.getTaskQueueLength(task.type);
    this.logger.info('[TaskService.createTask:new] taskType: %s, targetName: %s, taskId: %s, queue size: %s',
      task.type, task.targetName, task.taskId, queueLength);
    return task;
  }

  public async retryTask(task: Task, appendLog?: string) {
    if (appendLog) {
      await this.appendLogToNFS(task, appendLog);
    }
    task.state = TaskState.Waiting;
    await this.taskRepository.saveTask(task);
    await this.queueAdapter.push<string>(task.type, task.taskId);
    const queueLength = await this.getTaskQueueLength(task.type);
    this.logger.info('[TaskService.retryTask:save] taskType: %s, targetName: %s, taskId: %s, queue size: %s',
      task.type, task.targetName, task.taskId, queueLength);
  }

  public async findTask(taskId: string) {
    return await this.taskRepository.findTask(taskId);
  }

  public async findTasks(taskIdList: Array<string>) {
    return await this.taskRepository.findTasks(taskIdList);
  }

  public async findTaskLog(task: Task) {
    return await this.nfsAdapter.getDownloadUrlOrStream(task.logPath);
  }

  // 需要保证同时只会有一个相同的任务在运行
  // 防止任务并行导致请求结果冲突
  // 在 createTask 时已经确保不会有两个同时 waiting 的 Task
  // 但是可能相同的 task 正在执行，需要再做一次判断
  public async findExecuteTask(taskType: TaskType) {
    let taskId = await this.queueAdapter.pop<string>(taskType);
    let task: Task | null;

    while (taskId) {
      task = await this.taskRepository.findTask(taskId);

      // 任务已删除或任务已执行
      // 继续取下一个任务
      if (task === null || task?.state !== TaskState.Waiting) {
        taskId = await this.queueAdapter.pop<string>(taskType);
        continue;
      }

      const condition = task.start();
      const saveSucceed = await this.taskRepository.idempotentSaveTask(task, condition);
      if (!saveSucceed) {
        taskId = await this.queueAdapter.pop<string>(taskType);
        continue;
      }

      // 判断一下是否有相同任务正在执行
      // 如果有就先跳过，后续再执行
      const sameTaskList = await this.taskRepository.findTasksByTargetNameAndType(task.targetName, task.type);
      // 任务可能经过超时重试，存在多个 Waiting 状态的任务
      const anotherTaskIsProcessing = sameTaskList.some(item => item.state !== TaskState.Waiting);
      if (anotherTaskIsProcessing) {
        await this.queueAdapter.push<string>(taskType, taskId);
        const queueLength = await this.getTaskQueueLength(task.type);
        // 如果没有其他任务在执行，那么就等下次轮询时再做判断
        if (queueLength === 1) {
          break;
        }
        // 如果还有其他任务在执行，取下一个任务继续
        taskId = await this.queueAdapter.pop<string>(taskType);
        continue;
      }

      return task;
    }

    return null;
  }

  public async retryExecuteTimeoutTasks() {
    // try processing timeout tasks in 10 mins
    const tasks = await this.taskRepository.findTimeoutTasks(TaskState.Processing, 60000 * 10);
    for (const task of tasks) {
      // ignore ChangesStream task, it won't timeout
      if (task.attempts >= 3 && task.type !== TaskType.ChangesStream) {
        await this.finishTask(task, TaskState.Timeout);
        this.logger.warn(
          '[TaskService.retryExecuteTimeoutTasks:timeout] taskType: %s, targetName: %s, taskId: %s, attempts %s set to fail',
          task.type, task.targetName, task.taskId, task.attempts);
        continue;
      }
      if (task.attempts >= 1) {
        // reset logPath
        task.resetLogPath();
      }
      await this.retryTask(task);
      this.logger.info(
        '[TaskService.retryExecuteTimeoutTasks:retry] taskType: %s, targetName: %s, taskId: %s, attempts %s will retry again',
        task.type, task.targetName, task.taskId, task.attempts);
    }
    // try waiting timeout tasks in 30 mins
    const waitingTasks = await this.taskRepository.findTimeoutTasks(TaskState.Waiting, 60000 * 30);
    for (const task of waitingTasks) {
      await this.retryTask(task);
      this.logger.warn(
        '[TaskService.retryExecuteTimeoutTasks:retryWaiting] taskType: %s, targetName: %s, taskId: %s waiting too long',
        task.type, task.targetName, task.taskId);
    }
    return {
      processing: tasks.length,
      waiting: waitingTasks.length,
    };
  }

  public async appendTaskLog(task: Task, appendLog: string) {
    await this.appendLogToNFS(task, appendLog);
    await this.taskRepository.saveTask(task);
  }

  public async finishTask(task: Task, taskState: TaskState, appendLog?: string) {
    if (appendLog) {
      await this.appendLogToNFS(task, appendLog);
    }
    task.state = taskState;
    await this.taskRepository.saveTaskToHistory(task);
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
