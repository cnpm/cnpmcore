import assert from 'node:assert/strict';

import { uniq } from 'lodash-es';
import { AccessLevel, Inject, SingletonProto } from '@eggjs/tegg';

import { ModelConvertor } from './util/ModelConvertor.js';
import { isDuplicateKeyError } from './util/ErrorUtil.js';
import type { Task as TaskModel } from './model/Task.js';
import type { HistoryTask as HistoryTaskModel } from './model/HistoryTask.js';
import { AbstractRepository } from './AbstractRepository.js';
import type { TaskState, TaskType } from '../../app/common/enum/Task.js';
import {
  Task as TaskEntity,
  type TaskUpdateCondition,
} from '../core/entity/Task.js';

@SingletonProto({
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
      try {
        await ModelConvertor.convertEntityToModel(task, this.Task);
      } catch (e) {
        e.message = `[TaskRepository] insert Task failed: ${e.message}`;
        if (isDuplicateKeyError(e)) {
          this.logger.warn(e);
          const taskModel = await this.Task.findOne({ bizId: task.bizId });
          // 覆盖 bizId 相同的 id 和 taskId
          if (taskModel) {
            task.id = taskModel.id;
            task.taskId = taskModel.taskId;
            return;
          }
          // taskModel 可能不存在，遇到数据错误
          // 重新将错误抛出。
          throw e;
        }
        throw e;
      }
    }
  }

  async idempotentSaveTask(
    task: TaskEntity,
    condition: TaskUpdateCondition
  ): Promise<boolean> {
    assert.ok(task.id, 'task have no save');
    const changes = ModelConvertor.convertEntityToChanges(task, this.Task);
    const updateRows = await this.Task.update(
      {
        taskId: condition.taskId,
        attempts: condition.attempts,
      },
      changes
    );
    return updateRows === 1;
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

  async updateSpecificVersionsOfWaitingTask(
    task: TaskEntity,
    specificVersions?: string[]
  ): Promise<void> {
    const model = await this.Task.findOne({ id: task.id });
    if (!model || !model.data.specificVersions) return;
    if (specificVersions) {
      const data = model.data;
      const combinedVersions = uniq<string>(
        data.specificVersions.concat(specificVersions)
      );
      data.specificVersions = combinedVersions;
      await model.update({ data });
    } else {
      const data = model.data;
      Reflect.deleteProperty(data, 'specificVersions');
      await model.update({ data });
    }
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

  async findTaskByBizId(bizId: string) {
    const task = await this.Task.findOne({ bizId });
    if (task) {
      return ModelConvertor.convertModelToEntity(task, TaskEntity);
    }
    return null;
  }

  async findTasks(taskIds: string[]): Promise<TaskEntity[]> {
    const tasks = await this.HistoryTask.find({ taskId: { $in: taskIds } });
    return tasks.map(task =>
      ModelConvertor.convertModelToEntity(task, TaskEntity)
    );
  }

  async findTasksByCondition(where: {
    targetName?: string;
    state?: TaskState;
    type: TaskType;
  }): Promise<TaskEntity[]> {
    const tasks = await this.Task.find(where);
    return tasks.map(task =>
      ModelConvertor.convertModelToEntity(task, TaskEntity)
    );
  }

  async findTaskByTargetName(
    targetName: string,
    type: TaskType,
    state?: TaskState
  ) {
    const where: { targetName: string; type: TaskType; state?: TaskState } = {
      targetName,
      type,
    };
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
    return models.map(model =>
      ModelConvertor.convertModelToEntity(model, TaskEntity)
    );
  }

  async findTaskByAuthorIpAndType(authorIp: string, type: TaskType) {
    const models = await this.Task.find({
      type,
      authorIp,
    }).limit(1000);
    return models.map(model =>
      ModelConvertor.convertModelToEntity(model, TaskEntity)
    );
  }
}
