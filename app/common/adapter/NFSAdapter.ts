import {
  ContextProto,
  AccessLevel,
  Inject,
} from '@eggjs/tegg';
import { NFSClientAdapter } from './NFSClientAdapter';

@ContextProto({
  name: 'nfsAdapter',
  accessLevel: AccessLevel.PUBLIC,
})
export class NFSAdapter {
  @Inject()
  private nfsClientAdapter: NFSClientAdapter;

  async uploadBytes(storeKey: string, bytes: Uint8Array) {
    await this.nfsClientAdapter.client.uploadBuffer(bytes, { key: storeKey });
  }
}
