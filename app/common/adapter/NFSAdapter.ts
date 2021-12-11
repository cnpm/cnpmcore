import { Readable } from 'stream';
import {
  ContextProto,
  AccessLevel,
  Inject,
} from '@eggjs/tegg';
import { EggLogger } from 'egg';
import { NFSClientAdapter } from './NFSClientAdapter';
import { AsyncTimer } from '../decorator/AsyncTimer';

const INSTANCE_NAME = 'nfsAdapter';

@ContextProto({
  name: INSTANCE_NAME,
  accessLevel: AccessLevel.PUBLIC,
})
export class NFSAdapter {
  @Inject()
  private readonly nfsClientAdapter: NFSClientAdapter;

  @Inject()
  private readonly logger: EggLogger;

  @AsyncTimer(INSTANCE_NAME)
  async uploadBytes(storeKey: string, bytes: Uint8Array) {
    this.logger.info('[%s:uploadBytes] key: %s, bytes: %d', INSTANCE_NAME, storeKey, bytes.length);
    await this.nfsClientAdapter.client.uploadBuffer(bytes, { key: storeKey });
  }

  async appendBytes(storeKey: string, bytes: Uint8Array) {
    this.logger.info('[%s:appendBytes] key: %s, bytes: %d', INSTANCE_NAME, storeKey, bytes.length);
    await this.nfsClientAdapter.client.uploadBuffer(bytes, { key: storeKey });
  }

  @AsyncTimer(INSTANCE_NAME)
  async uploadFile(storeKey: string, file: string) {
    this.logger.info('[%s:uploadFile] key: %s, file: %s', INSTANCE_NAME, storeKey, file);
    await this.nfsClientAdapter.client.upload(file, { key: storeKey });
  }

  @AsyncTimer(INSTANCE_NAME)
  async remove(storeKey: string) {
    this.logger.info('[%s:remove] key: %s, file: %s', INSTANCE_NAME, storeKey);
    await this.nfsClientAdapter.client.remove(storeKey);
  }

  @AsyncTimer(INSTANCE_NAME)
  async getStream(storeKey: string): Promise<Readable | undefined> {
    return await this.nfsClientAdapter.client.createDownloadStream(storeKey);
  }

  @AsyncTimer(INSTANCE_NAME)
  async getBytes(storeKey: string): Promise<Uint8Array | undefined> {
    return await this.nfsClientAdapter.client.readBytes(storeKey);
  }

  async getDownloadUrlOrStream(storeKey: string): Promise<string | Readable | undefined> {
    if (typeof this.nfsClientAdapter.client.url === 'function') {
      return this.nfsClientAdapter.client.url(storeKey) as string;
    }
    return await this.getStream(storeKey);
  }
}
