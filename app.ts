import path from 'path';
import { readFile } from 'fs/promises';
import { Application } from 'egg';
import { ChangesStreamService } from './app/core/service/ChangesStreamService';
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

  // https://eggjs.org/zh-cn/basics/app-start.html
  async didReady() {
    // ready binary.html and replace registry
    const filepath = path.join(this.app.baseDir, 'app/port/binary.html');
    const text = await readFile(filepath, 'utf-8');
    this.app.binaryHTML = text.replace('{{registry}}', this.app.config.cnpmcore.registry);
  }

  // 应用退出时执行
  // 需要暂停当前执行的 changesStream task
  async beforeClose() {
    const changesStreamService = await this.app.getEggObject(ChangesStreamService);
    await changesStreamService.suspendSync(true);
  }
}
