import path from 'path';
import { readFile } from 'fs/promises';
import { Application } from 'egg';
import { ChangesStreamService } from './app/core/service/ChangesStreamService';
import { HookTriggerWorker } from './app/core/woker/HookTriggerWorker';
declare module 'egg' {
  interface Application {
    binaryHTML: string;
  }
}

export default class CnpmcoreAppHook {
  private readonly app: Application;

  constructor(app: Application) {
    this.app = app;
    this.app.binaryHTML = '';
  }

  async configWillLoad() {
    const app = this.app;
    // https://github.com/eggjs/tegg/blob/master/plugin/orm/app.ts#L37
    // store query sql to log
    app.config.orm.logger = {
      ...app.config.orm.logger,
      logQuery(sql: string, duration: number) {
        app.getLogger('sqlLogger').info('[%s] %s', duration, sql);
      },
    };

  }

  // https://eggjs.org/zh-cn/basics/app-start.html
  async didReady() {
    // ready binary.html and replace registry
    const filepath = path.join(this.app.baseDir, 'app/port/binary.html');
    const text = await readFile(filepath, 'utf-8');
    this.app.binaryHTML = text.replace('{{registry}}', this.app.config.cnpmcore.registry);

    // 由于 bullmq 内使用了异步 Worker 消费任务，脱离了 egg ctx 生命周期
    // 需要手动初始化，内部使用 getEggObject 获取 egg 对象
    new HookTriggerWorker(this.app);
  }

  // 应用退出时执行
  // 需要暂停当前执行的 changesStream task
  async beforeClose() {
    const changesStreamService = await this.app.getEggObject(ChangesStreamService);
    await changesStreamService.suspendSync(true);
  }
}
