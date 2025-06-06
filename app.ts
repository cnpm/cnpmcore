import path from 'node:path';
import { readFile } from 'node:fs/promises';
import type { Application, ILifecycleBoot } from 'egg';
import { ChangesStreamService } from './app/core/service/ChangesStreamService.js';

declare module 'egg' {
  interface Application {
    binaryHTML: string;
  }
}

export default class CnpmcoreAppHook implements ILifecycleBoot {
  private readonly app: Application;

  constructor(app: Application) {
    this.app = app;
    this.app.binaryHTML = '';
  }

  configWillLoad() {
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
    const text = await readFile(filepath, 'utf8');
    this.app.binaryHTML = text.replace(
      '{{registry}}',
      this.app.config.cnpmcore.registry
    );
  }

  // 应用退出时执行
  // 需要暂停当前执行的 changesStream task
  async beforeClose() {
    const changesStreamService =
      await this.app.getEggObject(ChangesStreamService);
    await changesStreamService.suspendSync(true);
  }
}
