import type { Readable } from 'node:stream';
import type { IncomingHttpHeaders } from 'node:http';

import { AccessLevel, Inject, SingletonProto, Logger } from 'egg';
import { Pointcut } from '@eggjs/tegg/aop';

import { AsyncTimer } from '../aop/AsyncTimer.ts';
import type { NFSClient } from '../typing.ts';

const INSTANCE_NAME = 'nfsAdapter';

@SingletonProto({
  name: INSTANCE_NAME,
  accessLevel: AccessLevel.PUBLIC,
})
export class NFSAdapter {
  @Inject()
  private readonly nfsClient: NFSClient;

  @Inject()
  private readonly logger: Logger;

  @Pointcut(AsyncTimer)
  async uploadBytes(storeKey: string, bytes: Uint8Array) {
    this.logger.info(
      '[%s:uploadBytes] key: %s, bytes: %d',
      INSTANCE_NAME,
      storeKey,
      bytes.length
    );
    await this.nfsClient.uploadBytes(bytes, { key: storeKey });
  }

  // will return next store position
  @Pointcut(AsyncTimer)
  async appendBytes(
    storeKey: string,
    bytes: Uint8Array,
    position?: string,
    headers?: IncomingHttpHeaders
  ) {
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
    this.logger.info(
      '[%s:uploadFile] key: %s, file: %s',
      INSTANCE_NAME,
      storeKey,
      file
    );
    await this.nfsClient.upload(file, { key: storeKey });
  }

  @Pointcut(AsyncTimer)
  async downloadFile(storeKey: string, file: string, timeout: number) {
    this.logger.info(
      '[%s:downloadFile] key: %s, file: %s, timeout: %s',
      INSTANCE_NAME,
      storeKey,
      file,
      timeout
    );
    await this.nfsClient.download(storeKey, file, { timeout });
  }

  @Pointcut(AsyncTimer)
  async remove(storeKey: string) {
    this.logger.info('[%s:remove] key: %s', INSTANCE_NAME, storeKey);
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

  async getDownloadUrlOrStream(
    storeKey: string
  ): Promise<string | Readable | undefined> {
    const downloadUrl = await this.getDownloadUrl(storeKey);
    if (downloadUrl) {
      return downloadUrl;
    }
    return await this.getStream(storeKey);
  }
}
