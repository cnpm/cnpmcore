import { Inject, LifecycleDestroy, LifecycleInit } from '@eggjs/tegg';
import { MQAdapter } from '../../infra/MQAdapter';
import { Job, UnrecoverableError, Worker } from 'bullmq';
import { EggAppConfig, EggLogger } from 'egg';
import { TaskService } from '../service/TaskService';

export abstract class AbstractWorker {
  @Inject()
  private readonly queueAdapter: MQAdapter;

  @Inject()
  private readonly config: EggAppConfig;

  @Inject()
  private readonly taskService: TaskService;

  @Inject()
  private readonly logger: EggLogger;

  @Inject()
  protected worker: Worker;

  queueKey: string;
  configKey: string;
  service;

  async initWorker() {
    throw new Error('should implements in subclass');
  }

  @LifecycleInit()
  protected async init() {
    this.initWorker();
    const queue = this.queueAdapter.initQueue(this.queueKey);
    this.worker = new Worker(
      queue.name,
      async (job: Job) => {
        const startTime = Date.now();
        const task = await this.taskService.findTask(job.data.taskId);
        if (!task) {
          throw new UnrecoverableError('task not found');
        }

        this.logger.info(`[${this.queueKey}Worker:subscribe:executeTask:start][%s] taskId: %s, targetName: %s, attempts: %s, params: %j, updatedAt: %s, delay %sms`,
          this.worker.concurrency, task.taskId, task.targetName, task.attempts, task.data, task.updatedAt,
          startTime - task.updatedAt.getTime());
        if (this.worker.concurrency !== this.config.cnpmcore[this.configKey]) {
          this.worker.concurrency = this.config.cnpmcore[this.configKey];
        }

        // TODO bullmq 移除了 timeout 配置，需要自己实现一个 promise.race 执行 timeout
        await this.service.executeTask(job.data);
      },
      {
        concurrency: this.config.cnpmcore[this.configKey],
      },
    );

    this.worker.on('completed', (job: Job) => {
      this.logger.info(`[${this.queueKey}Worker:subscribe:executeTask:success][%s] taskId: %s, targetName: %s, use %sms`,
        job.data.taskId, job.data.targetName, Date.now() - job.timestamp);
    });

    this.worker.on('failed', (job?: Job) => {
      if (!job) {
        return;
      }
      this.logger.info(`[${this.queueKey}Worker:subscribe:executeTask:failed][%s] taskId: %s, targetName: %s, attemptsMade %s`,
        job.data.taskId, job.data.targetName, job.attemptsMade);
    });

  }

  @LifecycleDestroy()
  protected async destroy() {
    await this.worker.close();
  }

}
