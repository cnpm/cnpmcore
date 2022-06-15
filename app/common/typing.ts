import { Readable } from 'stream';
import { IncomingHttpHeaders } from 'http';

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

export interface NFSClient {
  uploadBytes(bytes: Uint8Array, options: UploadOptions): Promise<UploadResult>;

  appendBytes(bytes: Uint8Array, options: AppendOptions): Promise<AppendResult>;

  upload(filePath: string, options: UploadOptions): Promise<UploadResult>;

  remove(key: string): Promise<void>;

  readBytes(key: string): Promise<Uint8Array | undefined>;

  createDownloadStream(key: string): Promise<Readable | undefined>;

  url?(key: string): string;
}
