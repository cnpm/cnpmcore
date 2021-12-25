import { Application } from 'egg';

declare module 'egg' {
  export interface Application {
    totalData: {
      packageCount: number;
      packageVersionCount: number;
      lastPackage: string;
      lastPackageVersion: string;
      download: {
        today: number;
        thisweek: number;
        thismonth: number;
        thisyear: number;
        lastday: number;
        lastweek: number;
        lastmonth: number;
        lastyear: number;
      };
      changesStream: object,
    };
  }
}

export default class CnpmcoreAppHook {
  private readonly app: Application;

  constructor(app: Application) {
    this.app = app;
    this.app.totalData = {
      packageCount: 0,
      packageVersionCount: 0,
      lastPackage: '',
      lastPackageVersion: '',
      download: {
        today: 0,
        thisweek: 0,
        thismonth: 0,
        thisyear: 0,
        lastday: 0,
        lastweek: 0,
        lastmonth: 0,
        lastyear: 0,
      },
      changesStream: {},
    };
  }

  // https://eggjs.org/zh-cn/basics/app-start.html
  async didReady() {
    this.app.messenger.on('cnpmcore:total_data_change', data => {
      this.app.totalData = data;
      this.app.logger.info('[total_data_change] %j', data);
    });
  }
}
