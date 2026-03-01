import crypto from 'node:crypto';

import { SingletonProto } from 'egg';

import binaries from '../../../../config/binaries.ts';
import { BinaryType } from '../../enum/Binary.ts';
import { BinaryAdapter, type BinaryItem, type FetchResult } from './AbstractBinary.ts';
import { BucketBinary } from './BucketBinary.ts';

/**
 * NW.js binary adapter.
 *
 * Root directory: scraped from https://dl.nwjs.io/ (HTML index)
 * Sub directories: listed via Cloudflare R2 S3-compatible API (ListObjectsV2)
 *
 * The R2 bucket credentials are publicly available in the nwjs frontend page.
 * @see https://github.com/cnpm/cnpmcore/issues/891
 */
@SingletonProto()
@BinaryAdapter(BinaryType.Nwjs)
export class NwjsBinary extends BucketBinary {
  // Cloudflare R2 S3-compatible endpoint for nwjs bucket
  private r2Endpoint = 'https://6883a4a09c48918c64df1ec7ddb744ba.r2.cloudflarestorage.com';
  private r2BucketName = 'nwjs';
  private r2AccessKeyId = '90fdca5d031b05eed0ef896a56a9521a';
  private r2SecretAccessKey = '34eeb665b34bfb9b773a8ff763a15e76621f541fdbbadeca6ed23e6d99c878ad';
  private r2Region = 'auto';

  async fetch(dir: string): Promise<FetchResult | undefined> {
    const binaryConfig = binaries.nwjs;
    const isRootDir = dir === '/';

    if (isRootDir) {
      return this.fetchRootDir(binaryConfig.distUrl);
    }

    return this.fetchSubDir(dir, binaryConfig);
  }

  private async fetchRootDir(distUrl: string): Promise<FetchResult | undefined> {
    const xml = await this.requestXml(distUrl);
    if (!xml) return;

    const items: BinaryItem[] = [];
    const re = /<td><a [^>]+?>([^<]+?\/)<\/a><\/td><td [^>]+?>([^>]+?)<\/td>/gi;
    const matchs = xml.matchAll(re);
    for (const m of matchs) {
      const name = m[1].trim();
      // ignore live-build/ name
      if (name === 'live-build/') continue;
      const date = m[2].trim();
      items.push({
        name,
        isDir: true,
        url: '',
        size: '-',
        date,
      });
    }
    return { items, nextParams: null };
  }

  private async fetchSubDir(dir: string, binaryConfig: typeof binaries.nwjs): Promise<FetchResult | undefined> {
    // /foo/ => foo/
    const prefix = dir.slice(1);
    const xml = await this.requestR2Xml(prefix);
    if (!xml) return;

    return { items: this.parseItems(xml, dir, binaryConfig), nextParams: null };
  }

  /**
   * Request R2 S3 ListObjectsV2 API with AWS Signature V4 authentication.
   */
  private async requestR2Xml(prefix: string): Promise<string> {
    const host = new URL(this.r2Endpoint).host;
    const now = new Date();
    const amzDate = now
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}/, '');
    const dateStamp = amzDate.slice(0, 8);

    const method = 'GET';
    const canonicalUri = `/${this.r2BucketName}`;

    // Build sorted query string
    const queryParams = new URLSearchParams({
      delimiter: '/',
      'list-type': '2',
      prefix: prefix,
    });
    queryParams.sort();
    const canonicalQueryString = queryParams.toString();

    // Build canonical request
    const payloadHash = crypto.createHash('sha256').update('').digest('hex');
    const canonicalHeaders = `host:${host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
    const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';

    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    // Build string to sign
    const credentialScope = `${dateStamp}/${this.r2Region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    // Calculate signature
    const signingKey = this.getSignatureKey(this.r2SecretAccessKey, dateStamp, this.r2Region, 's3');
    const signature = crypto.createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    const authorization = `AWS4-HMAC-SHA256 Credential=${this.r2AccessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const url = `${this.r2Endpoint}/${this.r2BucketName}?${canonicalQueryString}`;
    const { status, data, headers } = await this.httpclient.request(url, {
      timeout: 30_000,
      followRedirect: true,
      gzip: true,
      headers: {
        Authorization: authorization,
        'X-Amz-Content-Sha256': payloadHash,
        'X-Amz-Date': amzDate,
      },
    });

    const xml = data.toString() as string;
    if (status !== 200) {
      this.logger.warn(
        '[NwjsBinary.requestR2Xml:non-200-status] url: %s, status: %s, headers: %j, xml: %j',
        url,
        status,
        headers,
        xml,
      );
      return '';
    }
    return xml;
  }

  private getSignatureKey(key: string, dateStamp: string, region: string, service: string): Buffer {
    const kDate = crypto.createHmac('sha256', `AWS4${key}`).update(dateStamp).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update(service).digest();
    return crypto.createHmac('sha256', kService).update('aws4_request').digest();
  }
}
