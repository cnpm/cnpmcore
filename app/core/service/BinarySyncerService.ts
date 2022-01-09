import { rm } from 'fs/promises';
import {
  AccessLevel,
  ContextProto,
  Inject,
} from '@eggjs/tegg';
import {
  EggContextHttpClient,
} from 'egg';
import fs from 'fs/promises';
import { NFSAdapter } from '../../common/adapter/NFSAdapter';
import { TaskType, TaskState } from '../../common/enum/Task';
import { downloadToTempfile } from '../../common/FileUtil';
import { TaskRepository } from '../../repository/TaskRepository';
import { BinaryRepository } from '../../repository/BinaryRepository';
import { Task } from '../entity/Task';
import { Binary } from '../entity/Binary';
import { AbstractService } from './AbstractService';
import { TaskService } from './TaskService';
import { AbstractBinary, BinaryItem } from '../../common/adapter/binary/AbstractBinary';
import { ApiBinary } from '../../common/adapter/binary/ApiBinary';
import binaries, { SyncerClass } from '../../../config/binaries';
import { NodeBinary } from '../../common/adapter/binary/NodeBinary';
import { NwjsBinary } from '../../common/adapter/binary/NwjsBinary';
import { BucketBinary } from '../../common/adapter/binary/BucketBinary';
import { CypressBinary } from '../../common/adapter/binary/CypressBinary';
import { Sqlite3Binary } from '../../common/adapter/binary/Sqlite3Binary';
import { SqlcipherBinary } from '../../common/adapter/binary/SqlcipherBinary';
import { PuppeteerBinary } from '../../common/adapter/binary/PuppeteerBinary';
import { GithubBinary } from '../../common/adapter/binary/GithubBinary';

const BinaryClasses = {
  [SyncerClass.NodeBinary]: NodeBinary,
  [SyncerClass.NwjsBinary]: NwjsBinary,
  [SyncerClass.BucketBinary]: BucketBinary,
  [SyncerClass.CypressBinary]: CypressBinary,
  [SyncerClass.Sqlite3Binary]: Sqlite3Binary,
  [SyncerClass.SqlcipherBinary]: SqlcipherBinary,
  [SyncerClass.PuppeteerBinary]: PuppeteerBinary,
  [SyncerClass.GithubBinary]: GithubBinary,
};

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
    return await this.binaryRepository.listBinaries(binary.category, `${binary.parent}${binary.name}`);
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
    return await this.taskService.findExecuteTask(TaskType.SyncBinary, 60000 * 10);
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
      this.logger.error('[BinarySyncerService.executeTask:fail] taskId: %s, targetName: %s, %s',
        task.taskId, task.targetName, task.error);
      await this.taskService.finishTask(task, TaskState.Fail, logs.join('\n'));
      return;
    }

    await this.taskService.appendTaskLog(task, logs.join('\n'));
    logs = [];
    this.logger.info('[BinarySyncerService.executeTask:start] taskId: %s, targetName: %s, log: %s',
      task.taskId, task.targetName, logUrl);
    try {
      await this.syncDir(binaryInstance, task, '/');
      logs.push(`[${isoNow()}] 🟢 log: ${logUrl}`);
      logs.push(`[${isoNow()}] 🟢🟢🟢🟢🟢 "${binaryName}" 🟢🟢🟢🟢🟢`);
      await this.taskService.finishTask(task, TaskState.Success, logs.join('\n'));
      this.logger.info('[BinarySyncerService.executeTask:success] taskId: %s, targetName: %s, log: %s',
        task.taskId, task.targetName, logUrl);
    } catch (err: any) {
      task.error = err.message;
      logs.push(`[${isoNow()}] ❌ Synced "${binaryName}" fail, ${task.error}, log: ${logUrl}`);
      logs.push(`[${isoNow()}] ❌❌❌❌❌ "${binaryName}" ❌❌❌❌❌`);
      this.logger.error('[BinarySyncerService.executeTask:fail] taskId: %s, targetName: %s, %s',
        task.taskId, task.targetName, task.error);
      this.logger.error(err);
      await this.taskService.finishTask(task, TaskState.Fail, logs.join('\n'));
    }
  }

  private async syncDir(binaryInstance: AbstractBinary, task: Task, dir: string, parentIndex = '') {
    const binaryName = task.targetName;
    const result = await binaryInstance.fetch(dir, task.data);
    let hasDownloadError = false;
    let hasItems = false;
    if (result && result.items.length > 0) {
      hasItems = true;
      let logs: string[] = [];
      const newItems = await this.diff(binaryName, dir, result.items);
      logs.push(`[${isoNow()}][${dir}] 🚧 Syncing diff: ${result.items.length} => ${newItems.length}, Binary class: ${binaryInstance.constructor.name}`);
      for (const [ index, item ] of newItems.entries()) {
        if (item.isDir) {
          logs.push(`[${isoNow()}][${dir}] 🚧 [${parentIndex}${index}] Start sync dir ${JSON.stringify(item)}`);
          await this.taskService.appendTaskLog(task, logs.join('\n'));
          logs = [];
          const [ hasError, hasSubItems ] = await this.syncDir(binaryInstance, task, `${dir}${item.name}`, `${parentIndex}${index}.`);
          if (hasError) {
            hasDownloadError = true;
          } else {
            // if any file download error, let dir sync again next time
            // if empty dir, don't save it
            if (hasSubItems) {
              await this.saveBinaryItem(item);
            }
          }
        } else {
          // download to nfs
          logs.push(`[${isoNow()}][${dir}] 🚧 [${parentIndex}${index}] Downloading ${JSON.stringify(item)}`);
          await this.taskService.appendTaskLog(task, logs.join('\n'));
          logs = [];
          let localFile = '';
          try {
            const { tmpfile, headers, timing } =
              await downloadToTempfile(this.httpclient, this.config.dataDir, item.sourceUrl!, item.ignoreDownloadStatuses);
            logs.push(`[${isoNow()}][${dir}] 🟢 [${parentIndex}${index}] HTTP content-length: ${headers['content-length']}, timing: ${JSON.stringify(timing)}, ${item.sourceUrl} => ${tmpfile}`);
            localFile = tmpfile;
            const binary = await this.saveBinaryItem(item, tmpfile);
            logs.push(`[${isoNow()}][${dir}] 🟢 [${parentIndex}${index}] Synced file success, binaryId: ${binary.binaryId}`);
            await this.taskService.appendTaskLog(task, logs.join('\n'));
            logs = [];
          } catch (err: any) {
            if (err.name === 'DownloadNotFoundError') {
              this.logger.warn('Not found %s, skip it', item.sourceUrl);
              logs.push(`[${isoNow()}][${dir}] 🧪️ [${parentIndex}${index}] Download ${item.sourceUrl} not found, skip it`);
            } else {
              this.logger.error('Download binary %s %s', item.sourceUrl, err);
              hasDownloadError = true;
              logs.push(`[${isoNow()}][${dir}] ❌ [${parentIndex}${index}] Download ${item.sourceUrl} error: ${err}`);
            }
            await this.taskService.appendTaskLog(task, logs.join('\n'));
            logs = [];
          } finally {
            if (localFile) {
              await rm(localFile, { force: true });
            }
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
    return [ hasDownloadError, hasItems ];
  }

  private async diff(binaryName: string, dir: string, fetchItems: BinaryItem[]) {
    const existsItems = await this.binaryRepository.listBinaries(binaryName, dir);
    const existsMap = new Map<string, Binary>();
    for (const item of existsItems) {
      existsMap.set(item.name, item);
    }
    const diffItems: Binary[] = [];
    for (const item of fetchItems) {
      const existsItem = existsMap.get(item.name);
      if (!existsItem) {
        diffItems.push(Binary.create({
          category: binaryName,
          parent: dir,
          name: item.name,
          isDir: item.isDir,
          size: 0,
          date: item.date,
          sourceUrl: item.url,
          ignoreDownloadStatuses: item.ignoreDownloadStatuses,
        }));
      } else if (existsItem.date !== item.date) {
        existsItem.sourceUrl = item.url;
        existsItem.ignoreDownloadStatuses = item.ignoreDownloadStatuses;
        diffItems.push(existsItem);
      }
    }
    return diffItems;
  }

  private async saveBinaryItem(binary: Binary, tmpfile?: string) {
    if (tmpfile) {
      const stat = await fs.stat(tmpfile);
      binary.size = stat.size;
      await this.nfsAdapter.uploadFile(binary.storePath, tmpfile);
      this.logger.info('[BinarySyncerService.saveBinaryItem:uploadFile] binaryId: %s, size: %d, %s => %s',
        binary.binaryId, stat.size, tmpfile, binary.storePath);
    }
    await this.binaryRepository.saveBinary(binary);
    return binary;
  }

  private createBinaryInstance(binaryName: string): AbstractBinary | undefined {
    const config = this.config.cnpmcore;
    if (config.sourceRegistryIsCNpm) {
      const binaryConfig = binaries[binaryName];
      const syncBinaryFromAPISource = config.syncBinaryFromAPISource || `${config.sourceRegistry}/-/binary`;
      return new ApiBinary(this.httpclient, this.logger, binaryConfig, syncBinaryFromAPISource);
    }
    for (const binaryConfig of Object.values(binaries)) {
      if (binaryConfig.category === binaryName) {
        return new BinaryClasses[binaryConfig.syncer](this.httpclient, this.logger, binaryConfig);
      }
    }
  }
}
