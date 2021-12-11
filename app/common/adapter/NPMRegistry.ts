import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import path from 'path';
import { randomBytes } from 'crypto';
import {
  ContextProto,
  AccessLevel,
  Inject,
  EggObjectLifecycle,
} from '@eggjs/tegg';
import {
  EggLogger,
  EggContextHttpClient,
  EggAppConfig,
} from 'egg';
import { HttpMethod } from 'urllib';
import dayjs from '../dayjs';

const INSTANCE_NAME = 'npmRegistry';

@ContextProto({
  name: INSTANCE_NAME,
  accessLevel: AccessLevel.PUBLIC,
})
export class NPMRegistry implements EggObjectLifecycle {
  @Inject()
  private readonly logger: EggLogger;
  @Inject()
  private readonly httpclient: EggContextHttpClient;
  @Inject()
  private config: EggAppConfig;
  public registry: string;
  private timeout: 10000;

  async init() {
    this.registry = this.config.cnpmcore.sourceRegistry;
  }

  public async getFullManifests(fullname: string) {
    const url = `${this.registry}/${encodeURIComponent(fullname)}`;
    return await this.request('GET', url);
  }

  public async downloadTarball(tarball: string) {
    const uri = new URL(tarball);
    const tmpfile = path.join(this.config.dataDir, 'downloads', dayjs().format('YYYY/MM/DD'),
      `${randomBytes(10).toString('hex')}-${path.basename(uri.pathname)}`);
    await mkdir(path.dirname(tmpfile), { recursive: true });
    const writeStream = createWriteStream(tmpfile);
    const result = await this.request('GET', tarball, undefined, { timeout: 120000, writeStream });
    return {
      ...result,
      tmpfile,
    };
  }

  private async request(method: HttpMethod, url: string, params?: object, options?: object) {
    const res = await this.httpclient.request(url, {
      method,
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
