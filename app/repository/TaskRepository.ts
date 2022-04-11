import { AccessLevel, ContextProto } from '@eggjs/tegg';
import { ModelConvertor } from './util/ModelConvertor';
import { Task as TaskModel } from './model/Task';
import { HistoryTask as HistoryTaskModel } from './model/HistoryTask';
import { Task as TaskEntity } from '../core/entity/Task';
import { AbstractRepository } from './AbstractRepository';
import { TaskType, TaskState } from '../../app/common/enum/Task';

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class TaskRepository extends AbstractRepository {
  async saveTask(task: TaskEntity): Promise<void> {
    if (task.id) {
      const model = await TaskModel.findOne({ id: task.id });
      if (!model) return;
      await ModelConvertor.saveEntityToModel(task, model);
    } else {
      await ModelConvertor.convertEntityToModel(task, TaskModel);
    }
  }

  async saveTaskToHistory(task: TaskEntity): Promise<void> {
    const model = await TaskModel.findOne({ id: task.id });
    if (!model) return;
    const history = await HistoryTaskModel.findOne({ taskId: task.taskId });
    if (history) {
      await ModelConvertor.saveEntityToModel(task, history);
    } else {
      await ModelConvertor.convertEntityToModel(task, HistoryTaskModel);
    }
    await model.remove();
  }

  async findTask(taskId: string) {
    const task = await TaskModel.findOne({ taskId });
    if (task) {
      return ModelConvertor.convertModelToEntity(task, TaskEntity);
    }
    // try to read from history
    const history = await HistoryTaskModel.findOne({ taskId });
    if (history) {
      return ModelConvertor.convertModelToEntity(history, TaskEntity);
    }
    return null;
  }

  async findTaskByTargetName(targetName: string, type: TaskType, state?: TaskState) {
    const where: any = { targetName, type };
    if (state) {
      where.state = state;
    }
    const task = await TaskModel.findOne(where);
    if (task) {
      return ModelConvertor.convertModelToEntity(task, TaskEntity);
    }
    return null;
  }

  async findTimeoutTasks(taskState: TaskState, timeout: number) {
    const timeoutDate = new Date();
    timeoutDate.setTime(timeoutDate.getTime() - timeout);
    const models = await TaskModel.find({
      state: taskState,
      updatedAt: {
        $lt: timeoutDate,
      },
    }).limit(1000);
    return models.map(model => ModelConvertor.convertModelToEntity(model, TaskEntity));
  }
}
