import {
  AccessLevel,
  ContextProto,
  Inject,
} from '@eggjs/tegg';
import {
  EggContextHttpClient,
} from 'egg';
import { NFSAdapter } from '../../common/adapter/NFSAdapter';
import { NodeBinary } from '../../common/adapter/binary/NodeBinary';
import { TaskType, TaskState } from '../../common/enum/Task';
import { downloadToTempfile } from '../../common/FileUtil';
import { TaskRepository } from '../../repository/TaskRepository';
import { BinaryRepository } from '../../repository/BinaryRepository';
import { Task } from '../entity/Task';
import { Binary } from '../entity/Binary';
import { AbstractService } from './AbstractService';
import { TaskService } from './TaskService';
import { AbstractBinary, BinaryItem } from '../../common/adapter/binary/AbstractBinary';

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
  private readonly binaryRepository: BinaryRepository;
  @Inject()
  private readonly taskService: TaskService;
  @Inject()
  private readonly httpclient: EggContextHttpClient;
  @Inject()
  private readonly nfsAdapter: NFSAdapter;

  public async findBinary(binaryName: string, parent: string, name: string) {
    return await this.binaryRepository.findBinary(binaryName, parent, name);
  }

  public async listDirBinaries(binary: Binary) {
    return await this.binaryRepository.listBinaries(binary.type, `${binary.parent}${binary.name}`);
  }

  public async listRootBinaries(binaryName: string) {
    return await this.binaryRepository.listBinaries(binaryName, '/');
  }

  public async downloadBinary(binary: Binary) {
    return await this.nfsAdapter.getDownloadUrlOrStream(binary.storePath);
  }

  public async createTask(binaryName: string, lastData?: any) {
    const existsTask = await this.taskRepository.findTaskByTargetName(binaryName, TaskType.SyncBinary);
    if (existsTask) return existsTask;

    const task = Task.createSyncBinary(binaryName, lastData);
    await this.taskRepository.saveTask(task);
    this.logger.info('[BinarySyncerService.createTask:new] targetName: %s, taskId: %s',
      task.targetName, task.taskId);
    return task;
  }

  public async findTask(taskId: string) {
    return await this.taskService.findTask(taskId);
  }

  public async findTaskLog(task: Task) {
    return await this.taskService.findTaskLog(task);
  }

  public async findExecuteTask() {
    return await this.taskService.findExecuteTask(TaskType.SyncBinary);
  }

  public async executeTask(task: Task) {
    const binaryName = task.targetName;
    const binaryInstance = this.createBinaryInstance(binaryName);
    const logUrl = `${this.config.cnpmcore.registry}/-/binary/${binaryName}/syncs/${task.taskId}/log`;
    let logs: string[] = [];
    logs.push(`[${isoNow()}] 🚧🚧🚧🚧🚧 Start sync binary "${binaryName}" 🚧🚧🚧🚧🚧`);
    if (!binaryInstance) {
      task.error = 'unknow binaryName';
      logs.push(`[${isoNow()}] ❌ Synced "${binaryName}" fail, ${task.error}, log: ${logUrl}`);
      logs.push(`[${isoNow()}] ❌❌❌❌❌ "${binaryName}" ❌❌❌❌❌`);
      this.logger.info('[BinarySyncerService.executeTask:fail] taskId: %s, targetName: %s, %s',
        task.taskId, task.targetName, task.error);
      await this.taskService.finishTask(task, TaskState.Fail, logs.join('\n'));
      return;
    }
    await this.taskService.appendTaskLog(task, logs.join('\n'));
    logs = [];
    this.logger.info('[BinarySyncerService.executeTask:start] taskId: %s, targetName: %s, log: %s',
      task.taskId, task.targetName, logUrl);
    await this.syncDir(binaryInstance, task, '/');
    logs.push(`[${isoNow()}] 🟢 log: ${logUrl}`);
    logs.push(`[${isoNow()}] 🟢🟢🟢🟢🟢 "${binaryName}" 🟢🟢🟢🟢🟢`);
    await this.taskService.finishTask(task, TaskState.Success, logs.join('\n'));
    this.logger.info('[BinarySyncerService.executeTask:success] taskId: %s, targetName: %s, log: %s',
      task.taskId, task.targetName, logUrl);
  }

  private async syncDir(binaryInstance: AbstractBinary, task: Task, dir: string, parentIndex = '') {
    const binaryName = task.targetName;
    const result = await binaryInstance.fetch(dir, task.data);
    let hasDownloadError = false;
    if (result && result.items.length > 0) {
      let logs: string[] = [];
      const newItems = await this.diff(binaryName, dir, result.items);
      logs.push(`[${isoNow()}][${dir}] 🚧 Syncing diff: ${result.items.length} => ${newItems.length}`);
      for (const [ index, item ] of newItems.entries()) {
        if (item.isDir) {
          logs.push(`[${isoNow()}][${dir}] 🚧 [${parentIndex}${index}] Start sync dir ${JSON.stringify(item)}`);
          await this.taskService.appendTaskLog(task, logs.join('\n'));
          logs = [];
          const hasError = await this.syncDir(binaryInstance, task, `${dir}${item.name}`, `${parentIndex}${index}.`);
          if (hasError) {
            hasDownloadError = true;
          } else {
            // if any file download error, let dir sync again next time
            await this.saveBinaryItem(binaryName, dir, item);
          }
        } else {
          // download to nfs
          logs.push(`[${isoNow()}][${dir}] 🚧 [${parentIndex}${index}] Downloading ${JSON.stringify(item)}`);
          await this.taskService.appendTaskLog(task, logs.join('\n'));
          logs = [];
          try {
            const { tmpfile, headers, timing } =
              await downloadToTempfile(this.httpclient, this.config.dataDir, item.url);
            logs.push(`[${isoNow()}][${dir}] 🟢 [${parentIndex}${index}] HTTP content-length: ${headers['content-length']}, timing: ${JSON.stringify(timing)}, ${item.url} => ${tmpfile}`);
            const binary = await this.saveBinaryItem(binaryName, dir, item, tmpfile);
            logs.push(`[${isoNow()}][${dir}] 🟢 [${parentIndex}${index}] Synced file success, binaryId: ${binary.binaryId}`);
            await this.taskService.appendTaskLog(task, logs.join('\n'));
            logs = [];
          } catch (err) {
            this.logger.error('Download binary %s %s', item.url, err);
            hasDownloadError = true;
            logs.push(`[${isoNow()}][${dir}] ❌ [${parentIndex}${index}] Download ${item.url} error: ${err}`);
            await this.taskService.appendTaskLog(task, logs.join('\n'));
            logs = [];
          }
        }
      }
      if (hasDownloadError) {
        logs.push(`[${isoNow()}][${dir}] ❌ Synced dir fail`);
      } else {
        logs.push(`[${isoNow()}][${dir}] 🟢 Synced dir success`);
      }
      await this.taskService.appendTaskLog(task, logs.join('\n'));
    }
    return hasDownloadError;
  }

  private async diff(binaryName: string, dir: string, fetchItems: BinaryItem[]) {
    const existsItems = await this.binaryRepository.listBinaries(binaryName, dir);
    const existsSet = new Set<string>(existsItems.map(item => item.name));
    return fetchItems.filter(item => {
      return !existsSet.has(item.name);
    });
  }

  private async saveBinaryItem(binaryName: string, dir: string, item: BinaryItem, tmpfile?: string) {
    const binary = Binary.create({
      type: binaryName,
      parent: dir,
      name: item.name,
      isDir: item.isDir,
      size: item.size,
      date: item.date,
    });
    if (tmpfile) {
      await this.nfsAdapter.uploadFile(binary.storePath, tmpfile);
      this.logger.info('[BinarySyncerService.saveBinaryItem:uploadFile] binaryId: %s, %s => %s',
        binary.binaryId, tmpfile, binary.storePath);
    }
    await this.binaryRepository.saveBinary(binary);
    return binary;
  }

  private createBinaryInstance(binaryName: string): AbstractBinary | undefined {
    if (binaryName === 'node') return new NodeBinary(this.httpclient, this.logger);
  }
}
