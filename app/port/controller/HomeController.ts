import { performance } from 'perf_hooks';
import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  Context,
  EggContext,
} from '@eggjs/tegg';
import { AbstractController } from './AbstractController';

const startTime = new Date();

@HTTPController()
export class HomeController extends AbstractController {
  @HTTPMethod({
    // GET /
    // https://github.com/cnpm/cnpmjs.org/blob/master/docs/registry-api.md#schema
    path: '/',
    method: HTTPMethodEnum.GET,
  })
  async showTotal() {
    const data = {
      db_name: 'registry',
      engine: this.config.orm.client,
      doc_count: 0,
      doc_del_count: 0,
      update_seq: 0,
      disk_size: 0,
      data_size: 0,
      instance_start_time: startTime,
      // only for cnpmcore
      doc_version_count: 0,
      sync_model: this.config.cnpmcore.syncMode,
      download: {
        today: 0,
        thisweek: 0,
        thismonth: 0,
        lastday: 0,
        lastweek: 0,
        lastmonth: 0,
        total: 0,
      },
      node_version: process.version,
      app_version: this.config.pkg.version,
      // donate: 'https://github.com/cnpm/cnpmcore',
      // cache_time: 0,
    };
    return data;
  }

  // https://github.com/npm/cli/blob/latest/lib/utils/ping.js#L5
  // https://registry.npmjs.org/-/ping?write=true
  @HTTPMethod({
    // GET /-/ping
    path: '/-/ping',
    method: HTTPMethodEnum.GET,
  })
  async ping(@Context() ctx: EggContext) {
    return {
      pong: true,
      use: performance.now() - ctx.performanceStarttime!,
    };
  }
}
