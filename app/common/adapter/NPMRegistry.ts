import { setTimeout } from 'timers/promises';
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
  public registryHost: string;

  get registry(): string {
    if (this.registryHost) {
      return this.registryHost;
    }
    return this.config.cnpmcore.sourceRegistry;
  }

  public setRegistryHost(registryHost = '') {
    this.registryHost = registryHost;
  }

  public async getFullManifests(fullname: string, retries = 3) {
    // set query t=timestamp, make sure CDN cache disable
    // cache=0 is sync worker request flag
    const url = `${this.registry}/${encodeURIComponent(fullname)}?t=${Date.now()}&cache=0`;
    let lastError: any;
    while (retries > 0) {
      try {
        // large package: https://r.cnpmjs.org/%40procore%2Fcore-icons
        // https://r.cnpmjs.org/intraactive-sdk-ui 44s
        return await this.request('GET', url, undefined, { timeout: 120000 });
      } catch (err: any) {
        if (err.name === 'ResponseTimeoutError') throw err;
        lastError = err;
      }
      retries--;
      if (retries > 0) {
        // sleep 1s ~ 4s in random
        await setTimeout(1000 + Math.random() * 4000);
      }
    }
    throw lastError;
  }

  // app.put('/:name/sync', sync.sync);
  public async createSyncTask(fullname: string) {
    const url = `${this.registry}/${encodeURIComponent(fullname)}/sync?sync_upstream=true&nodeps=true`;
    // {
    //   ok: true,
    //   logId: logId
    // };
    return await this.request('PUT', url);
  }

  // app.get('/:name/sync/log/:id', sync.getSyncLog);
  public async getSyncTask(fullname: string, id: string, offset: number) {
    const url = `${this.registry}/${encodeURIComponent(fullname)}/sync/log/${id}?offset=${offset}`;
    // { ok: true, syncDone: syncDone, log: log }
    return await this.request('GET', url);
  }

  public async getDownloadRanges(registry: string, fullname: string, start: string, end: string) {
    const url = `${registry}/downloads/range/${start}:${end}/${encodeURIComponent(fullname)}`;
    return await this.request('GET', url);
  }

  private async request(method: HttpMethod, url: string, params?: object, options?: object) {
    const res = await this.httpclient.request(url, {
      method,
      data: params,
      dataType: 'json',
      timing: true,
      timeout: this.timeout,
      followRedirect: true,
      gzip: true,
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
