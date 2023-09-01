import { CnpmcoreConfig } from '../port/config';
import { Readable } from 'stream';
import { IncomingHttpHeaders } from 'http';
import { EggContext } from '@eggjs/tegg';
import { estypes } from '@elastic/elasticsearch';

export interface UploadResult {
  key: string;
}

export interface AppendResult {
  key: string;
  nextAppendPosition?: number;
}

export interface UploadOptions {
  key: string;
}

export interface AppendOptions {
  key: string;
  position?: string,
  headers?: IncomingHttpHeaders,
}

export interface DownloadOptions {
  timeout: number;
}

export interface NFSClient {
  uploadBytes(bytes: Uint8Array, options: UploadOptions): Promise<UploadResult>;

  appendBytes(bytes: Uint8Array, options: AppendOptions): Promise<AppendResult>;

  upload(filePath: string, options: UploadOptions): Promise<UploadResult>;

  remove(key: string): Promise<void>;

  readBytes(key: string): Promise<Uint8Array | undefined>;

  createDownloadStream(key: string): Promise<Readable | undefined>;

  download(key: string, filepath: string, options: DownloadOptions): Promise<void>;

  url?(key: string): string;
}

export interface QueueAdapter {
  push<T>(key: string, item: T): Promise<boolean>;
  pop<T>(key: string): Promise<T | null>;
  length(key: string): Promise<number>;
}

export interface SearchAdapter {
  search<T>(query: any): Promise<estypes.SearchHitsMetadata<T>>;
  upsert<T>(id: string, document: T): Promise<string>;
  delete(id: string): Promise<string>;
}

export interface AuthUrlResult {
  loginUrl: string;
  doneUrl: string;
}

export interface userResult {
  name: string;
  email: string;
}
export interface AuthClient {
  getAuthUrl(ctx: EggContext): Promise<AuthUrlResult>;
  ensureCurrentUser(): Promise<userResult | null>;
}

declare module 'egg' {
  // eslint-disable-next-line
  // @ts-ignore
  // avoid TS2310 Type 'EggAppConfig' recursively references itself as a base type.
  interface EggAppConfig {
    cnpmcore: CnpmcoreConfig;
  }
}
