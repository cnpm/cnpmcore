import { Transform, Readable } from 'stream';
import { pipeline } from 'stream/promises';
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

  async getStream(storeKey: string): Promise<Readable> {
    return await this.nfsClientAdapter.client.createDownloadStream(storeKey);
  }

  @AsyncTimer(INSTANCE_NAME)
  async getBytes(storeKey: string): Promise<Uint8Array> {
    const stream = await this.getStream(storeKey);
    const chunks: Uint8Array[] = [];
    let size = 0;
    await pipeline(
      stream,
      new Transform({
        objectMode: false,
        transform: (chunk: Uint8Array, _, done) => {
          chunks.push(chunk);
          size += chunk.length;
          done();
        },
      }),
    );
    this.logger.info('[%s:getBytes] key: %s, bytes: %d',
      INSTANCE_NAME, storeKey, size);
    return Buffer.concat(chunks, size);
  }

  async getDownloadUrlOrStream(storeKey: string): Promise<string | Readable> {
    if (typeof this.nfsClientAdapter.client.url === 'function') {
      return this.nfsClientAdapter.client.url(storeKey) as string;
    }
    return await this.getStream(storeKey);
  }
}
