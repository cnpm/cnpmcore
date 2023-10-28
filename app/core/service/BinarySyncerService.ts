import { rm } from 'fs/promises';
import {
  AccessLevel,
  SingletonProto,
  Inject,
  EggObjectFactory,
} from '@eggjs/tegg';
import {
  EggHttpClient,
} from 'egg';
import fs from 'fs/promises';
import binaries, { BinaryName, CategoryName } from '../../../config/binaries';
import { NFSAdapter } from '../../common/adapter/NFSAdapter';
import { TaskType, TaskState } from '../../common/enum/Task';
import { downloadToTempfile } from '../../common/FileUtil';
import { BinaryRepository } from '../../repository/BinaryRepository';
import { Task } from '../entity/Task';
import { Binary } from '../entity/Binary';
import { TaskService } from './TaskService';
import { AbstractBinary, BinaryItem } from '../../common/adapter/binary/AbstractBinary';
import { AbstractService } from '../../common/AbstractService';
import { TaskRepository } from '../../repository/TaskRepository';
import { BinaryType } from '../../common/enum/Binary';
import { sortBy } from 'lodash';

function isoNow() {
  return new Date().toISOString();
}

@SingletonProto({
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
  private readonly httpclient: EggHttpClient;
  @Inject()
  private readonly nfsAdapter: NFSAdapter;
  @Inject()
  private readonly eggObjectFactory: EggObjectFactory;

  // canvas/v2.6.1/canvas-v2.6.1-node-v57-linux-glibc-x64.tar.gz
  // -> node-canvas-prebuilt/v2.6.1/node-canvas-prebuilt-v2.6.1-node-v57-linux-glibc-x64.tar.gz
  // canvas 历史版本的 targetName 可能是 category 需要兼容
  public async findBinary(targetName: BinaryName | CategoryName, parent: string, name: string) {
    return await this.binaryRepository.findBinary(targetName, parent, name);
  }

  public async listDirBinaries(binary: Binary) {
    return await this.binaryRepository.listBinaries(binary.category, `${binary.parent}${binary.name}`);
  }

  public async listRootBinaries(binaryName: BinaryName) {
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
  public async createTask(binaryName: BinaryName, lastData?: any) {
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
    const binaryName = task.targetName as BinaryName;
    const binaryAdapter = await this.getBinaryAdapter(binaryName);
    const logUrl = `${this.config.cnpmcore.registry}/-/binary/${binaryName}/syncs/${task.taskId}/log`;
    let logs: string[] = [];
    logs.push(`[${isoNow()}] 🚧🚧🚧🚧🚧 Start sync binary "${binaryName}" 🚧🚧🚧🚧🚧`);
    if (!binaryAdapter) {
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
      await this.syncDir(binaryAdapter, task, '/');
      logs.push(`[${isoNow()}] 🟢 log: ${logUrl}`);
      logs.push(`[${isoNow()}] 🟢🟢🟢🟢🟢 "${binaryName}" 🟢🟢🟢🟢🟢`);
      await this.taskService.finishTask(task, TaskState.Success, logs.join('\n'));
      this.logger.info('[BinarySyncerService.executeTask:success] taskId: %s, targetName: %s, log: %s',
        task.taskId, task.targetName, logUrl);
    } catch (err: any) {
      task.error = err.message;
      logs.push(`[${isoNow()}] ❌ Synced "${binaryName}" fail, ${task.error}, log: ${logUrl}`);
      logs.push(`[${isoNow()}] ❌❌❌❌❌ "${binaryName}" ❌❌❌❌❌`);
      if (err.name === 'HttpClientRequestTimeoutError'
        || err.name === 'ConnectionError'
        || err.name === 'ConnectTimeoutError') {
        this.logger.warn('[BinarySyncerService.executeTask:fail] taskId: %s, targetName: %s, %s',
          task.taskId, task.targetName, task.error);
        this.logger.warn(err);
      } else {
        this.logger.error('[BinarySyncerService.executeTask:fail] taskId: %s, targetName: %s, %s',
          task.taskId, task.targetName, task.error);
        this.logger.error(err);
      }
      await this.taskService.finishTask(task, TaskState.Fail, logs.join('\n'));
    }
  }

  private async syncDir(binaryAdapter: AbstractBinary, task: Task, dir: string, parentIndex = '', latestVersionParent = '/') {
    const binaryName = task.targetName as BinaryName;
    const result = await binaryAdapter.fetch(dir, binaryName);
    let hasDownloadError = false;
    let hasItems = false;
    if (result && result.items.length > 0) {
      hasItems = true;
      let logs: string[] = [];
      const { newItems, latestVersionDir } = await this.diff(binaryName, dir, result.items, latestVersionParent);
      logs.push(`[${isoNow()}][${dir}] 🚧 Syncing diff: ${result.items.length} => ${newItems.length}, Binary class: ${binaryAdapter.constructor.name}`);
      // re-check latest version
      for (const [ index, { item, reason }] of newItems.entries()) {
        if (item.isDir) {
          logs.push(`[${isoNow()}][${dir}] 🚧 [${parentIndex}${index}] Start sync dir ${JSON.stringify(item)}, reason: ${reason}`);
          await this.taskService.appendTaskLog(task, logs.join('\n'));
          logs = [];
          const [ hasError, hasSubItems ] = await this.syncDir(binaryAdapter, task, `${dir}${item.name}`, `${parentIndex}${index}.`, latestVersionDir);
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
          // skip exists binary file
          const existsBinary = await this.binaryRepository.findBinary(item.category, item.parent, item.name);
          if (existsBinary && existsBinary.date === item.date) {
            logs.push(`[${isoNow()}][${dir}] 🟢 [${parentIndex}${index}] binary file exists, skip download, binaryId: ${existsBinary.binaryId}`);
            this.logger.info('[BinarySyncerService.syncDir:skipDownload] binaryId: %s exists, storePath: %s',
              existsBinary.binaryId, existsBinary.storePath);
            continue;
          }
          await this.taskService.appendTaskLog(task, logs.join('\n'));
          logs = [];
          let localFile = '';
          try {
            const { tmpfile, headers, timing } =
              await downloadToTempfile(
                this.httpclient, this.config.dataDir, item.sourceUrl!, { ignoreDownloadStatuses: item.ignoreDownloadStatuses });
            const log = `[${isoNow()}][${dir}] 🟢 [${parentIndex}${index}] HTTP content-length: ${headers['content-length']}, timing: ${JSON.stringify(timing)}, ${item.sourceUrl} => ${tmpfile}`;
            logs.push(log);
            this.logger.info('[BinarySyncerService.syncDir:downloadToTempfile] %s', log);
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
              if (err.name === 'DownloadStatusInvalidError') {
                this.logger.warn('Download binary %s %s', item.sourceUrl, err);
              } else {
                this.logger.error('Download binary %s %s', item.sourceUrl, err);
              }
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


  // see https://github.com/cnpm/cnpmcore/issues/556
  // 上游可能正在发布新版本、同步流程中断，导致同步的时候，文件列表不一致
  // 如果的当前目录命中 latestVersionParent 父目录，那么就再校验一下当前目录
  // 如果 existsItems 为空或者经过修改，那么就不需要 revalidate 了
  private async diff(binaryName: BinaryName, dir: string, fetchItems: BinaryItem[], latestVersionParent = '/') {
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
      } else if (dir.endsWith(latestVersionParent)) {
        const isLatestItem = sortBy(fetchItems, [ 'date' ]).pop()?.name === item.name;
        if (isLatestItem && existsItem.isDir) {
          diffItems.push({
            item: existsItem,
            reason: `revalidate latest version, latest parent dir is ${latestVersionParent}, current dir is ${dir}, current name is ${existsItem.name}`,
          });
          latestVersionParent = `${latestVersionParent}${existsItem.name}`;
        }
      }
    }


    return {
      newItems: diffItems,
      latestVersionDir: latestVersionParent,
    };
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

  private async getBinaryAdapter(binaryName: BinaryName): Promise<AbstractBinary | undefined> {
    const config = this.config.cnpmcore;
    const binaryConfig = binaries[binaryName];

    let binaryAdapter: AbstractBinary;
    if (config.sourceRegistryIsCNpm) {
      binaryAdapter = await this.eggObjectFactory.getEggObject(AbstractBinary, BinaryType.Api);
    } else {
      binaryAdapter = await this.eggObjectFactory.getEggObject(AbstractBinary, binaryConfig.type);
    }
    await binaryAdapter.initFetch(binaryName);
    return binaryAdapter;
  }
}
