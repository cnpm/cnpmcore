import {
  ContextProto,
  AccessLevel,
  Inject,
} from '@eggjs/tegg';
import {
  EggLogger,
  EggContextHttpClient,
  EggAppConfig,
} from 'egg';
import { HttpMethod } from 'urllib';

const INSTANCE_NAME = 'npmRegistry';

@ContextProto({
  name: INSTANCE_NAME,
  accessLevel: AccessLevel.PUBLIC,
})
export class NPMRegistry {
  @Inject()
  private readonly logger: EggLogger;
  @Inject()
  private readonly httpclient: EggContextHttpClient;
  @Inject()
  private config: EggAppConfig;
  private timeout = 10000;

  get registry(): string {
    return this.config.cnpmcore.sourceRegistry;
  }

  public async getFullManifests(fullname: string) {
    const url = `${this.registry}/${encodeURIComponent(fullname)}`;
    return await this.request('GET', url);
  }

  public async createSyncTask(fullname: string) {
    const url = `${this.registry}/-/package/${encodeURIComponent(fullname)}/syncs`;
    // {
    //   ok: true,
    //   "id": "61f155c211e20438b3234187",
    //   "type": "sync_package",
    //   "state": "waiting"
    // };
    return await this.request('PUT', url, {
      skipDependencies: true,
    });
  }

  public async getSyncTask(fullname: string, id: string) {
    const url = `${this.registry}/-/package/${encodeURIComponent(fullname)}/syncs/${id}`;
    // {"ok":true,"id":"61f155c211e20438b3234187","type":"sync_package","state":"success","logUrl":"https://r.cnpmjs.org/-/package/geckodriver/syncs/61f155c211e20438b3234187/log"}
    return await this.request('GET', url);
  }

  public async getDownloadRanges(registry: string, fullname: string, start: string, end: string) {
    const url = `${registry}/downloads/range/${start}:${end}/${encodeURIComponent(fullname)}`;
    return await this.request('GET', url);
  }

  private async request(method: HttpMethod, url: string, params?: object, options?: object) {
    const res = await this.httpclient.request(url, {
      method,
      contentType: 'json',
      data: params,
      dataType: 'json',
      timing: true,
      timeout: this.timeout,
      followRedirect: true,
      ...options,
    });
    this.logger.info('[NPMRegistry:request] %s %s, status: %s', method, url, res.status);
    return {
      method,
      url,
      ...res,
    };
  }
}
