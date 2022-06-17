import { Readable } from 'stream';
import {
  ContextProto,
  AccessLevel,
  Inject,
} from '@eggjs/tegg';
import { Pointcut } from '@eggjs/tegg/aop';
import { EggLogger } from 'egg';
import { AsyncTimer } from '../aop/AsyncTimer';
import { NFSClient } from '../typing';
import { IncomingHttpHeaders } from 'http';

const INSTANCE_NAME = 'nfsAdapter';

@ContextProto({
  name: INSTANCE_NAME,
  accessLevel: AccessLevel.PUBLIC,
})
export class NFSAdapter {
  @Inject()
  private readonly nfsClient: NFSClient;

  @Inject()
  private readonly logger: EggLogger;

  @Pointcut(AsyncTimer)
  async uploadBytes(storeKey: string, bytes: Uint8Array) {
    this.logger.info('[%s:uploadBytes] key: %s, bytes: %d', INSTANCE_NAME, storeKey, bytes.length);
    await this.nfsClient.uploadBytes(bytes, { key: storeKey });
  }

  // will return next store position
  @Pointcut(AsyncTimer)
  async appendBytes(storeKey: string, bytes: Uint8Array, position?: string, headers?: IncomingHttpHeaders) {
    // make sure position is undefined by the first time
    if (!position) position = undefined;
    const options = {
      key: storeKey,
      position,
      headers,
    };
    const result = await this.nfsClient.appendBytes(bytes, options);
    if (result?.nextAppendPosition) return String(result.nextAppendPosition);
  }

  @Pointcut(AsyncTimer)
  async uploadFile(storeKey: string, file: string) {
    this.logger.info('[%s:uploadFile] key: %s, file: %s', INSTANCE_NAME, storeKey, file);
    await this.nfsClient.upload(file, { key: storeKey });
  }

  @Pointcut(AsyncTimer)
  async remove(storeKey: string) {
    this.logger.info('[%s:remove] key: %s, file: %s', INSTANCE_NAME, storeKey);
    await this.nfsClient.remove(storeKey);
  }

  @Pointcut(AsyncTimer)
  async getStream(storeKey: string): Promise<Readable | undefined> {
    return await this.nfsClient.createDownloadStream(storeKey);
  }

  @Pointcut(AsyncTimer)
  async getBytes(storeKey: string): Promise<Uint8Array | undefined> {
    return await this.nfsClient.readBytes(storeKey);
  }

  @Pointcut(AsyncTimer)
  async getDownloadUrl(storeKey: string): Promise<string | undefined> {
    if (typeof this.nfsClient.url === 'function') {
      return this.nfsClient.url(storeKey) as string;
    }
  }

  async getDownloadUrlOrStream(storeKey: string): Promise<string | Readable | undefined> {
    const downloadUrl = await this.getDownloadUrl(storeKey);
    if (downloadUrl) {
      return downloadUrl;
    }
    return await this.getStream(storeKey);
  }
}
