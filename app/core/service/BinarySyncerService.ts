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
import binaries, { SyncerClass } from '../../../config/binaries';
import { NFSAdapter } from '../../common/adapter/NFSAdapter';
import { TaskType, TaskState } from '../../common/enum/Task';
import { downloadToTempfile } from '../../common/FileUtil';
import { BinaryRepository } from '../../repository/BinaryRepository';
import { Task } from '../entity/Task';
import { Binary } from '../entity/Binary';
import { TaskService } from './TaskService';
import { AbstractBinary, BinaryItem } from '../../common/adapter/binary/AbstractBinary';
import { ApiBinary } from '../../common/adapter/binary/ApiBinary';
import { AbstractService } from '../../common/AbstractService';
import { NodeBinary } from '../../common/adapter/binary/NodeBinary';
import { NwjsBinary } from '../../common/adapter/binary/NwjsBinary';
import { BucketBinary } from '../../common/adapter/binary/BucketBinary';
import { CypressBinary } from '../../common/adapter/binary/CypressBinary';
import { SqlcipherBinary } from '../../common/adapter/binary/SqlcipherBinary';
import { PuppeteerBinary } from '../../common/adapter/binary/PuppeteerBinary';
import { GithubBinary } from '../../common/adapter/binary/GithubBinary';
import { ElectronBinary } from '../../common/adapter/binary/ElectronBinary';
import { NodePreGypBinary } from '../../common/adapter/binary/NodePreGypBinary';
import { ImageminBinary } from '../../common/adapter/binary/ImageminBinary';
import { PlaywrightBinary } from '../../common/adapter/binary/PlaywrightBinary';
import { TaskRepository } from 'app/repository/TaskRepository';

const BinaryClasses = {
  [SyncerClass.NodeBinary]: NodeBinary,
  [SyncerClass.NwjsBinary]: NwjsBinary,
  [SyncerClass.BucketBinary]: BucketBinary,
  [SyncerClass.CypressBinary]: CypressBinary,
  [SyncerClass.SqlcipherBinary]: SqlcipherBinary,
  [SyncerClass.PuppeteerBinary]: PuppeteerBinary,
  [SyncerClass.GithubBinary]: GithubBinary,
  [SyncerClass.ElectronBinary]: ElectronBinary,
  [SyncerClass.NodePreGypBinary]: NodePreGypBinary,
  [SyncerClass.ImageminBinary]: ImageminBinary,
  [SyncerClass.PlaywrightBinary]: PlaywrightBinary,
};

function isoNow() {
  return new Date().toISOString();
}

@ContextProto({
  accessLevel: AccessLevel.PUBLIC,
})
export class BinarySyncerService extends AbstractService {
  @Inject()
  private readonly binaryRepository: BinaryRepository;
  @Inject()
  private readonly taskService: TaskService;
  @Inject()
  private readonly taskRepository: TaskRepository;
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
    // 通常 binaryName 和 category 是一样的，但是有些特殊的 binaryName 会有多个 category，比如 canvas
    // 所以查询 canvas 的时候，需要将 binaryName 和 category 的数据都查出来
    const {
      category,
    } = binaries[binaryName];
    const reqs = [
      this.binaryRepository.listBinaries(binaryName, '/'),
    ];
    if (category && category !== binaryName) {
      reqs.push(this.binaryRepository.listBinaries(category, '/'));
    }

    const [
      rootBinary,
      categoryBinary,
    ] = await Promise.all(reqs);

    const versions = rootBinary.map(b => b.name);
    categoryBinary?.forEach(b => {
      const version = b.name;
      // 只将没有的版本添加进去
      if (!versions.includes(version)) {
        rootBinary.push(b);
      }
    });

    return rootBinary;
  }

  public async downloadBinary(binary: Binary) {
    return await this.nfsAdapter.getDownloadUrlOrStream(binary.storePath);
  }

  // SyncBinary 由定时任务每台单机定时触发，手动去重
  // 添加 bizId 在 db 防止重复，记录 id 错误
  public async createTask(binaryName: string, lastData?: any) {
    const existsTask = await this.taskRepository.findTaskByTargetName(binaryName, TaskType.SyncBinary);
    if (existsTask) {
      return existsTask;
    }
    try {
      return await this.taskService.createTask(Task.createSyncBinary(binaryName, lastData), false);
    } catch (e) {
      this.logger.error('[BinarySyncerService.createTask] binaryName: %s, error: %s', binaryName, e);
    }
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
      for (const [ index, { item, reason }] of newItems.entries()) {
        if (item.isDir) {
          logs.push(`[${isoNow()}][${dir}] 🚧 [${parentIndex}${index}] Start sync dir ${JSON.stringify(item)}, reason: ${reason}`);
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
          logs.push(`[${isoNow()}][${dir}] 🚧 [${parentIndex}${index}] Downloading ${JSON.stringify(item)}, reason: ${reason}`);
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
              this.logger.info('Not found %s, skip it', item.sourceUrl);
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
    const diffItems: { item: Binary; reason: string }[] = [];
    for (const item of fetchItems) {
      const existsItem = existsMap.get(item.name);
      if (!existsItem) {
        diffItems.push({
          item: Binary.create({
            category: binaryName,
            parent: dir,
            name: item.name,
            isDir: item.isDir,
            size: 0,
            date: item.date,
            sourceUrl: item.url,
            ignoreDownloadStatuses: item.ignoreDownloadStatuses,
          }),
          reason: 'new item',
        });
      } else if (existsItem.date !== item.date) {
        diffItems.push({
          item: existsItem,
          reason: `date diff, local: ${JSON.stringify(existsItem.date)}, remote: ${JSON.stringify(item.date)}`,
        });
        existsItem.sourceUrl = item.url;
        existsItem.ignoreDownloadStatuses = item.ignoreDownloadStatuses;
        existsItem.date = item.date;
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
    const binaryConfig = binaries[binaryName];

    if (config.sourceRegistryIsCNpm) {
      const syncBinaryFromAPISource = config.syncBinaryFromAPISource || `${config.sourceRegistry}/-/binary`;
      return new ApiBinary(this.httpclient, this.logger, binaryConfig, syncBinaryFromAPISource, binaryName);
    }

    return new BinaryClasses[binaryConfig.syncer](this.httpclient, this.logger, binaryConfig, binaryName);
  }
}
