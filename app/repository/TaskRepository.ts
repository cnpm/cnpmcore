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

  async findTaskByTargetName(targetName: string, type: TaskType, state: TaskState) {
    const task = await TaskModel.findOne({ targetName, type, state });
    if (task) {
      return ModelConvertor.convertModelToEntity(task, TaskEntity);
    }
    return null;
  }

  async executeWaitingTask(taskType: TaskType) {
    // https://zhuanlan.zhihu.com/p/20293493?refer=alsotang
    // Task list impl from MySQL
    const GET_WAITING_TASK_SQL = `UPDATE tasks SET gmt_modified=now(3), state=?, attempts=attempts+1, id=LAST_INSERT_ID(id)
WHERE type=? AND state=? ORDER BY gmt_modified ASC LIMIT 1`;
    let result = await TaskModel.driver.query(GET_WAITING_TASK_SQL,
      [ TaskState.Processing, taskType, TaskState.Waiting ]);
    // if has task, affectedRows > 0 and insertId > 0
    if (result.affectedRows && result.affectedRows > 0 && result.insertId && result.insertId > 0) {
      this.logger.info('[TaskRepository:executeWaitingTask:waiting] type: %s, result: %j', taskType, result);
      const task = await TaskModel.findOne({ id: result.insertId });
      if (task) {
        return ModelConvertor.convertModelToEntity(task, TaskEntity);
      }
    }

    // try to find timeout task, 5 mins
    const timeoutDate = new Date();
    timeoutDate.setTime(timeoutDate.getTime() - 60000 * 5);
    const GET_TIMEOUT_TASK_SQL = `UPDATE tasks SET gmt_modified=now(3), state=?, attempts=attempts+1, id=LAST_INSERT_ID(id)
WHERE type=? AND state=? AND gmt_modified<? ORDER BY gmt_modified ASC LIMIT 1`;
    result = await TaskModel.driver.query(GET_TIMEOUT_TASK_SQL,
      [ TaskState.Processing, taskType, TaskState.Processing, timeoutDate ]);
    // if has task, affectedRows > 0 and insertId > 0
    if (result.affectedRows && result.affectedRows > 0 && result.insertId && result.insertId > 0) {
      this.logger.info('[TaskRepository:executeWaitingTask:timeout] type: %s, result: %j, timeout: %j',
        taskType, result, timeoutDate);
      const task = await TaskModel.findOne({ id: result.insertId });
      if (task) {
        return ModelConvertor.convertModelToEntity(task, TaskEntity);
      }
    }
    return null;
  }
}
