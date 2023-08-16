import { performance } from 'perf_hooks';
import {
  HTTPController,
  HTTPMethod,
  HTTPMethodEnum,
  Context,
  EggContext,
  Inject,
} from '@eggjs/tegg';
import { AbstractController } from './AbstractController';
import { CacheService, DownloadInfo, UpstreamRegistryInfo } from '../../core/service/CacheService';
import { HomeService } from '../../core/service/HomeService';

const startTime = new Date();

// registry 站点信息数据 SiteTotalData
// SiteEnvInfo: 环境、运行时相关信息，实时查询
// UpstreamInfo: 上游信息，实时查询
// TotalInfo: 总数据信息，定时任务每分钟生成
// LegacyInfo: 旧版兼容信息
type SiteTotalData = LegacyInfo & SiteEnvInfo & TotalInfo;

type LegacyInfo = {
  source_registry: string,
  changes_stream_registry: string,
  sync_changes_steam: any,
};

type SiteEnvInfo = {
  sync_model: string;
  sync_binary: boolean;
  instance_start_time: Date;
  node_version: string;
  app_version: string;
  engine: string;
  cache_time: string;
};

type TotalInfo = {
  last_package: string;
  last_package_version: string;
  doc_count: number | bigint;
  doc_version_count: number | bigint;
  update_seq: number | bigint;
  download: DownloadInfo;
  upstream_registries?: UpstreamRegistryInfo[];
};


@HTTPController()
export class HomeController extends AbstractController {
  @Inject()
  private readonly cacheService: CacheService;

  @Inject()
  private readonly homeService: HomeService;

  @HTTPMethod({
    // GET /
    // https://github.com/cnpm/cnpmjs.org/blob/master/docs/registry-api.md#schema
    path: '/',
    method: HTTPMethodEnum.GET,
  })
  // 2023-1-20
  // 原有 LegacyInfo 字段继续保留，由于 ChangesStream 信息通过 registry 表配置，可能会过期
  // 新增 upstream_registries 字段，展示上游源站 registry 信息列表
  async showTotal() {
    const totalData = await this.cacheService.getTotalData();
    const data: SiteTotalData = {
      last_package: totalData.lastPackage,
      last_package_version: totalData.lastPackageVersion,
      doc_count: totalData.packageCount,
      doc_version_count: totalData.packageVersionCount,
      download: totalData.download,
      update_seq: totalData.lastChangeId,
      sync_model: this.config.cnpmcore.syncMode,
      sync_changes_steam: totalData.changesStream,
      sync_binary: this.config.cnpmcore.enableSyncBinary,
      instance_start_time: startTime,
      node_version: process.version,
      app_version: this.config.pkg.version,
      engine: this.config.orm.client,
      source_registry: this.config.cnpmcore.sourceRegistry,
      changes_stream_registry: this.config.cnpmcore.changesStreamRegistry,
      cache_time: totalData.cacheTime,
      upstream_registries: totalData.upstreamRegistries,
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

  @HTTPMethod({
    path: '/*',
    method: HTTPMethodEnum.POST,
    priority: -Infinity,
  })
  async miscPost(@Context() ctx: EggContext) {
    await this.homeService.misc(ctx.path);
  }

  @HTTPMethod({
    path: '/*',
    method: HTTPMethodEnum.GET,
    priority: -Infinity,
  })
  async miscGet(@Context() ctx: EggContext) {
    await this.homeService.misc(ctx.path);
  }

}
