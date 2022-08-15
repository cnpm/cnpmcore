import { AccessLevel, ContextProto, Inject } from '@eggjs/tegg';
import { ModelConvertor } from './util/ModelConvertor';
import type { Task as TaskModel } from './model/Task';
import type { HistoryTask as HistoryTaskModel } from './model/HistoryTask';
import { Task as TaskEntity } from '../core/entity/Task';
import { AbstractRepository } from './AbstractRepository';
import { TaskType, TaskState } from '../../app/common/enum/Task';

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class TaskRepository extends AbstractRepository {
  @Inject()
  private readonly Task: typeof TaskModel;

  @Inject()
  private readonly HistoryTask: typeof HistoryTaskModel;

  async saveTask(task: TaskEntity): Promise<void> {
    if (task.id) {
      const model = await this.Task.findOne({ id: task.id });
      if (!model) return;
      await ModelConvertor.saveEntityToModel(task, model);
    } else {
      await ModelConvertor.convertEntityToModel(task, this.Task);
    }
  }

  async saveTaskToHistory(task: TaskEntity): Promise<void> {
    const model = await this.Task.findOne({ id: task.id });
    if (!model) return;
    const history = await this.HistoryTask.findOne({ taskId: task.taskId });
    if (history) {
      await ModelConvertor.saveEntityToModel(task, history);
    } else {
      await ModelConvertor.convertEntityToModel(task, this.HistoryTask);
    }
    await model.remove();
  }

  async findTask(taskId: string) {
    const task = await this.Task.findOne({ taskId });
    if (task) {
      return ModelConvertor.convertModelToEntity(task, TaskEntity);
    }
    // try to read from history
    const history = await this.HistoryTask.findOne({ taskId });
    if (history) {
      return ModelConvertor.convertModelToEntity(history, TaskEntity);
    }
    return null;
  }

  async findTasks(taskIds: Array<string>): Promise<Array<TaskEntity>> {
    const tasks = await this.HistoryTask.find({ taskId: { $in: taskIds } });
    return tasks.map(task => ModelConvertor.convertModelToEntity(task, TaskEntity));
  }

  async findTaskByTargetName(targetName: string, type: TaskType, state?: TaskState) {
    const where: any = { targetName, type };
    if (state) {
      where.state = state;
    }
    const task = await this.Task.findOne(where);
    if (task) {
      return ModelConvertor.convertModelToEntity(task, TaskEntity);
    }
    return null;
  }

  async findTimeoutTasks(taskState: TaskState, timeout: number) {
    const timeoutDate = new Date();
    timeoutDate.setTime(timeoutDate.getTime() - timeout);
    const models = await this.Task.find({
      state: taskState,
      updatedAt: {
        $lt: timeoutDate,
      },
    }).limit(1000);
    return models.map(model => ModelConvertor.convertModelToEntity(model, TaskEntity));
  }
}
