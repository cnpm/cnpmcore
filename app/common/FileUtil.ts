import { mkdir, rm } from 'fs/promises';
import { createWriteStream } from 'fs';
import { setTimeout } from 'timers/promises';
import path from 'path';
import url from 'url';
import { randomBytes } from 'crypto';
import { EggContextHttpClient, HttpClientResponse } from 'egg';
import dayjs from './dayjs';

interface DownloadToTempfileOptionalConfig {
  retries?: number,
  ignoreDownloadStatuses?: number[],
  remoteAuthToken?: string
}

export async function createTempfile(dataDir: string, filename: string) {
  // will auto clean on CleanTempDir Schedule
  const tmpdir = path.join(dataDir, 'downloads', dayjs().format('YYYY/MM/DD'));
  await mkdir(tmpdir, { recursive: true });

  // The filename is a URL (from dist.tarball), which needs to be truncated, (`getconf NAME_MAX /` # max filename length: 255 bytes)
  // https://github.com/cnpm/cnpmjs.org/pull/1345
  const tmpfile = path.join(tmpdir, `${randomBytes(10).toString('hex')}-${path.basename(url.parse(filename).pathname!)}`);
  return tmpfile;
}

export async function downloadToTempfile(httpclient: EggContextHttpClient,
  dataDir: string, url: string, optionalConfig?: DownloadToTempfileOptionalConfig) {
  let retries = optionalConfig?.retries || 3;
  let lastError: any;
  while (retries > 0) {
    try {
      return await _downloadToTempfile(httpclient, dataDir, url, optionalConfig);
    } catch (err: any) {
      if (err.name === 'DownloadNotFoundError') throw err;
      lastError = err;
    }
    retries--;
    if (retries > 0) {
      // sleep 1s ~ 4s in random
      const delay = process.env.NODE_ENV === 'test' ? 1 : 1000 + Math.random() * 4000;
      await setTimeout(delay);
    }
  }
  throw lastError;
}
export interface Tempfile {
  tmpfile: string;
  headers: HttpClientResponse['res']['headers'];
  timing: HttpClientResponse['res']['timing'];
}
async function _downloadToTempfile(httpclient: EggContextHttpClient,
  dataDir: string, url: string, optionalConfig?: DownloadToTempfileOptionalConfig): Promise<Tempfile> {
  const tmpfile = await createTempfile(dataDir, url);
  const writeStream = createWriteStream(tmpfile);
  try {
    // max 10 mins to download
    // FIXME: should show download progress
    const authorization = optionalConfig?.remoteAuthToken ? `Bearer ${optionalConfig?.remoteAuthToken}` : '';
    const { status, headers, res } = await httpclient.request(url, {
      timeout: 60000 * 10,
      headers: { authorization },
      writeStream,
      timing: true,
      followRedirect: true,
    }) as HttpClientResponse;
    if (status === 404 || (optionalConfig?.ignoreDownloadStatuses && optionalConfig.ignoreDownloadStatuses.includes(status))) {
      const err = new Error(`Not found, status(${status})`);
      err.name = 'DownloadNotFoundError';
      throw err;
    }
    if (status !== 200) {
      const err = new Error(`Download ${url} status(${status}) invalid`);
      err.name = 'DownloadStatusInvalidError';
      throw err;
    }
    return {
      tmpfile,
      headers,
      timing: res.timing,
    };
  } catch (err) {
    await rm(tmpfile, { force: true });
    throw err;
  }
}
