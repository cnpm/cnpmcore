import { MQAdapter } from '../../infra/MQAdapter';
import { Job, UnrecoverableError, Worker } from 'bullmq';
import { Application } from 'egg';
import { TaskService } from '../service/TaskService';

export abstract class AbstractWorker {
  constructor(app: Application) {
    this.app = app;
    this.registerWorker();
  }

  protected worker: Worker;

  app: Application;
  queueKey: string;
  configKey: string;

  queueAdapter: MQAdapter;
  taskService: TaskService;
  serviceClass: any;
  service: any;

  async initWorker() {
    await this.initWorkerInfo();
    this.queueAdapter = await this.app.getEggObject(MQAdapter);
    this.taskService = await this.app.getEggObject(TaskService);
    this.service = await this.app.getEggObject(this.serviceClass);
  }

  async initWorkerInfo() {
    throw new Error('not implement');
  }

  async registerWorker() {
    await this.initWorker();
    if (this.app.config.cnpmcore[this.configKey] === 0) {
      return;
    }
    const queue = this.queueAdapter.initQueue(this.queueKey);
    this.worker = new Worker(
      queue.name,
      async (job: Job) => {
        await this.app.runInAnonymousContextScope(async ctx => {
          await ctx.beginModuleScope(async () => {

            console.log('!'.repeat(20), this.app.config.cnpmcore[this.configKey]);
            const startTime = Date.now();
            const task = await this.taskService.findTask(job.data.taskId);
            if (!task) {
              throw new UnrecoverableError('task not found');
            }

            if (this.worker.concurrency !== this.app.config.cnpmcore[this.configKey]) {
              this.worker.concurrency = this.app.config.cnpmcore[this.configKey];
            }
            this.app.logger.info(`[${this.queueKey}_worker:subscribe:executeTask:start] taskId: %s, targetName: %s, attempts: %s, params: %j, updatedAt: %s, delay %sms`,
              task.taskId, task.targetName, task.attempts, task.data, task.updatedAt,
              startTime - task.updatedAt.getTime());

            // TODO bullmq 移除了 timeout 配置，需要自己实现一个 promise.race 执行 timeout
            await this.service.executeTask(task as any);
          });
        });
      },
      {
        concurrency: this.app.config.cnpmcore[this.configKey],
      },
    );

    this.worker.on('completed', (job: Job) => {
      this.app.logger.info(`[${this.queueKey}_worker:subscribe:executeTask:success] taskId: %s, targetName: %s, use %sms`,
        job.data.taskId, job.data.targetName, Date.now() - job.timestamp);
    });

    this.worker.on('failed', (job?: Job) => {
      if (!job) {
        return;
      }
      this.app.logger.info(`[${this.queueKey}_worker:subscribe:executeTask:failed] taskId: %s, targetName: %s, attemptsMade %s`,
        job.data.taskId, job.data.targetName, job.attemptsMade);
    });

  }

}
