import { performance } from 'perf_hooks';
import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  Context,
  EggContext,
} from '@eggjs/tegg';
import { BaseController } from '../type/BaseController';

@HTTPController()
export class HomeController extends BaseController {
  @HTTPMethod({
    // GET /
    // https://github.com/cnpm/cnpmjs.org/blob/master/docs/registry-api.md#schema
    path: '/',
    method: HTTPMethodEnum.GET,
  })
  async showTotal(@Context() ctx: EggContext) {
    const data = {
      db_name: 'registry',
      engine: ctx.app.config.orm.client,
      doc_count: 0,
      doc_del_count: 0,
      update_seq: 0,
      purge_seq: 0,
      compact_running: false,
      sizes: {
        active: 0,
        external: 0,
        file: 0,
      },
      disk_size: 0,
      data_size: 0,
      other: {
        data_size: 0,
      },
      instance_start_time: Math.floor((Date.now() - performance.now()) * 1000),
      disk_format_version: 0,
      committed_update_seq: 0,
      compacted_seq: 0,
      uuid: '',
      // only for cnpmcore
      doc_version_count: 0,
      sync_model: '',
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
      app_version: ctx.app.config.pkg.version,
      // donate: 'https://github.com/cnpm/cnpmcore',
      cache_time: 0,
    };
    return data;
  }
}
