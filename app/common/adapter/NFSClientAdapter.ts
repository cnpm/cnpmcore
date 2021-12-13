import {
  SingletonProto,
  AccessLevel,
  Inject,
  EggObjectLifecycle,
} from '@eggjs/tegg';
import {
  EggLogger,
  EggAppConfig,
} from 'egg';
import FSClient from 'fs-cnpm';

@SingletonProto({
  name: 'nfsClientAdapter',
  accessLevel: AccessLevel.PRIVATE,
})
export class NFSClientAdapter implements EggObjectLifecycle {
  @Inject()
  private logger: EggLogger;

  @Inject()
  private config: EggAppConfig;

  private _client: any;

  async init() {
    // NFS interface https://github.com/cnpm/cnpmjs.org/wiki/NFS-Guide
    if (this.config.nfs.client) {
      this._client = this.config.nfs.client;
      return;
    }
    if (this.config.env === 'prod') {
      throw new Error('[NFSAdapter] Can\'t use local fs NFS on production env');
    }

    // try to use fs-cnpm, don't use it on production env
    this.logger.warn('[NFSAdapter] Don\'t use local fs NFS on production env, store on %s', this.config.nfs.dir);
    this._client = new FSClient({ dir: this.config.nfs.dir });
  }

  get client() {
    return this._client;
  }
}
