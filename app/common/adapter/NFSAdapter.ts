import {
  SingletonProto,
  AccessLevel,
  Inject,
} from '@eggjs/tegg';
import {
  EggLogger,
  EggAppConfig,
} from 'egg';
import * as FSClient from 'fs-cnpm';

@SingletonProto({
  name: 'nfsAdapter',
  accessLevel: AccessLevel.PUBLIC,
})
export class NFSAdapter {
  @Inject()
  private logger: EggLogger;

  @Inject()
  private config: EggAppConfig;

  private nfsClient: any;

  constructor() {
    console.error('dddd');
    if (this.config.nfs.client) {
      this.nfsClient = this.config.nfs.client;
      return;
    }
    // try to use fs-cnpm, don't use it on production env
    this.logger.error('[NFSAdapter] Don\'t use local fs NFS on production env');
    this.nfsClient = new FSClient({ dir: this.config.nfs.dir });
    console.log(this.nfsClient);
  }

  async uploadBuffer(buf: Uint8Array, options: any) {
    return await this.nfsClient.uploadBuffer(buf, options);
  }
}
