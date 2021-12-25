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
  async showTotal(@Context() ctx: EggContext) {
    const totalData = ctx.app.totalData;
    const data = {
      last_pacakge: totalData.lastPackage,
      last_pacakge_version: totalData.lastPackageVersion,
      doc_count: totalData.packageCount,
      doc_version_count: totalData.packageVersionCount,
      download: totalData.download,
      update_seq: 0,
      sync_model: this.config.cnpmcore.syncMode,
      sync_changes_steam: totalData.changesStream,
      instance_start_time: startTime,
      node_version: process.version,
      app_version: this.config.pkg.version,
      engine: this.config.orm.client,
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
