import { Transform, Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
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

  async uploadFile(storeKey: string, file: string) {
    await this.nfsClientAdapter.client.upload(file, { key: storeKey });
  }

  async getStream(storeKey: string): Promise<Readable> {
    return await this.nfsClientAdapter.client.createDownloadStream(storeKey);
  }

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
    return Buffer.concat(chunks, size);
  }

  async getDownloadUrlOrStream(storeKey: string): Promise<string | Readable> {
    if (typeof this.nfsClientAdapter.client.url === 'function') {
      return this.nfsClientAdapter.client.url(storeKey) as string;
    }
    return await this.getStream(storeKey);
  }
}
