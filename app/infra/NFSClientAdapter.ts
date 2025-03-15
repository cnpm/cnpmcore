import type { Readable } from 'node:stream';
import {
  AccessLevel,
  Inject,
  LifecycleInit,
  SingletonProto,
} from '@eggjs/tegg';
import type { EggAppConfig, EggLogger } from 'egg';
import FSClient from 'fs-cnpm';

import type {
  AppendResult,
  DownloadOptions,
  NFSClient,
  UploadOptions,
  UploadResult,
} from '../common/typing.js';

@SingletonProto({
  name: 'nfsClient',
  accessLevel: AccessLevel.PUBLIC,
})
export class NFSClientAdapter implements NFSClient {
  @Inject()
  private logger: EggLogger;

  @Inject()
  private config: EggAppConfig;

  private _client: any;

  get client() {
    return this._client;
  }

  url?(key: string): string;

  @LifecycleInit()
  protected async init() {
    // NFS interface https://github.com/cnpm/cnpmjs.org/wiki/NFS-Guide
    if (this.config.nfs.client) {
      this._client = this.config.nfs.client;
    } else {
      if (this.config.env === 'prod') {
        throw new Error(
          "[NFSAdapter] Can't use local fs NFS on production env"
        );
      }

      // try to use fs-cnpm, don't use it on production env
      this.logger.warn(
        "[NFSAdapter] Don't use local fs NFS on production env, store on %s",
        this.config.nfs.dir
      );
      this._client = new FSClient({ dir: this.config.nfs.dir });
    }

    if (typeof this._client.url === 'function') {
      this.url = this._client.url.bind(this._client);
    }
  }

  async appendBytes(
    bytes: Uint8Array,
    options: UploadOptions
  ): Promise<AppendResult> {
    if (this._client.appendBytes) {
      return await this._client.appendBytes(bytes, options);
    }
    return await this._client.appendBuffer(bytes, options);
  }

  async createDownloadStream(key: string): Promise<Readable | undefined> {
    return await this._client.createDownloadStream(key);
  }

  async readBytes(key: string): Promise<Uint8Array | undefined> {
    return await this._client.readBytes(key);
  }

  async remove(key: string): Promise<void> {
    return await this._client.remove(key);
  }

  async upload(
    filePath: string,
    options: UploadOptions
  ): Promise<UploadResult> {
    if (this.config.nfs.removeBeforeUpload) {
      await this.remove(options.key);
    }
    return await this._client.upload(filePath, options);
  }

  async uploadBytes(
    bytes: Uint8Array,
    options: UploadOptions
  ): Promise<UploadResult> {
    if (this.config.nfs.removeBeforeUpload) {
      await this.remove(options.key);
    }
    if (this._client.uploadBytes) {
      return await this._client.uploadBytes(bytes, options);
    }
    return await this._client.uploadBuffer(bytes, options);
  }

  async download(
    key: string,
    filePath: string,
    options: DownloadOptions
  ): Promise<void> {
    return await this._client.download(key, filePath, options);
  }
}
