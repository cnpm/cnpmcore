import {
  ContextProto,
  AccessLevel,
  Inject,
} from '@eggjs/tegg';
import {
  EggLogger,
} from 'egg';
import { NFSClientAdapter } from './NFSClientAdapter';

type Options = {
  key: string;
  integrity: string;
  shasum: string;
};

@ContextProto({
  name: 'nfsAdapter',
  accessLevel: AccessLevel.PUBLIC,
})
export class NFSAdapter {
  @Inject()
  private logger: EggLogger;

  @Inject()
  private nfsClientAdapter: NFSClientAdapter;

  async uploadBuffer(buf: Uint8Array, options: Options) {
    const result = await this.nfsClientAdapter.client.uploadBuffer(buf, options);
    this.logger.info('[nfs:uploadBuffer] result: %j', result);
    return result;
  }

  getStoreKey(name: string, filename: string) {
    // without scoped: /egg/-/egg-2.26.0.tgz
    // scoped: /@npm/spife/-/@npm/spife-10.0.6.tgz
    // if name is scope package name, need to auto fix filename as a scope package file name
    // e.g.: name: @scope/foo, filename: foo-1.0.0.tgz ==> filename: @scope/foo-1.0.0.tgz
    if (name[0] === '@' && filename[0] !== '@') {
      filename = name.split('/')[0] + '/' + filename;
    }
    return '/' + name + '/-/' + filename;
  }
}
