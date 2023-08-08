declare module 'fs-cnpm' {
  export default class FSClient extends NFSClient {
    constructor(options: {
      dir: string;
    });
  }
}

declare module 'ssri' {
  export interface Integrity {
    algorithm: string;
    digest: string;
    options?: string[];
  }

  export interface HashLike {
    digest: string;
    algorithm: string;
    options?: string[];
    sha1: {
      hexDigest(): string;
    }[];
    sha512: { toString(): string }[];
  }

  export interface HashOptions {
    algorithms?: string[];
    options?: string[];
  }

  export interface IntegrityOptions {
    algorithms?: string[];
    options?: string[];
    single?: boolean;
  }

  export interface CreateRes {
    update(v: string): { digest: () => { toString() }; };
  }

  export function fromHex(hexDigest: string, algorithm: string, options?: string[]): Integrity;

  export function fromData(data: Buffer | string | Uint8Array, options?: HashOptions): HashLike;

  export function fromStream(stream: NodeJS.ReadableStream, options?: HashOptions): Promise<HashLike>;

  export function checkData(data: Buffer | string, sri: string | Integrity, options?: IntegrityOptions): boolean;

  export function checkStream(stream: NodeJS.ReadableStream, sri: string | Integrity, options?: IntegrityOptions): Promise<boolean>;

  export function parse(sri: string): Integrity;

  export function create(): CreateRes;

  export function stringify(integrity: Integrity, options?: { strict?: boolean }): string;
}

declare module 'oss-cnpm' {
  import { Readable } from 'stream';

  export interface AppendResult {
    name: string;
    url: string;
    etag: string;
    size: number;
  }

  export interface UploadOptions {
    key: string;
    content: Readable;
    size: number;
  }

  export interface UploadResult {
    name: string;
    url: string;
    etag: string;
    size: number;
  }

  export interface DownloadOptions {
    key: string;
  }

  export default class OSSClient {
    constructor(options: {
      cdnBaseUrl?: string;
      accessKeyId: string;
      accessKeySecret: string;
      bucket: string;
      internal?: boolean;
      secure?: boolean;
      timeout?: number;
      cname?: boolean;
      endpoint?: string;
      defaultHeaders?: Record<string, string>;
    });

    append(options: UploadOptions): Promise<AppendResult>;

    upload(options: UploadOptions): Promise<UploadResult>;

    download(options: DownloadOptions): Promise<Readable>;

    delete(key: string): Promise<void>;

    exists(key: string): Promise<boolean>;

    stat(key: string): Promise<{ size: number }>;

    url(key: string): string;
  }
}
