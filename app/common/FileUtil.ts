import { mkdir, rm } from 'fs/promises';
import { createWriteStream } from 'fs';
import path from 'path';
import { randomBytes } from 'crypto';
import { EggContextHttpClient } from 'egg';
import dayjs from './dayjs';
import ProgressBar from 'progress';
import _ from 'lodash';

let fileContentLen = 0;
let fileChunkLen = 0;

export async function createTempfile(dataDir: string, filename: string) {
  // will auto clean on CleanTempDir Schedule
  const tmpdir = path.join(dataDir, 'downloads', dayjs().format('YYYY/MM/DD'));
  await mkdir(tmpdir, { recursive: true });
  const tmpfile = path.join(tmpdir, `${randomBytes(10).toString('hex')}-${path.basename(filename)}`);
  return tmpfile;
}

export async function downloadToTempfile(httpclient: EggContextHttpClient, dataDir: string, url: string, ignoreDownloadStatuses?: number[]) {
  const tmpfile = await createTempfile(dataDir, url);
  const writeStream = createWriteStream(tmpfile);
  try {
    // max 10 mins to download
    const { status, headers, res } = await httpclient.request(url, {
      timeout: 60000 * 10,
      writeStream,
      timing: true,
      followRedirect: true,
      streaming: true,
    });
    // show download progress
    const len = parseInt(_.get(headers, 'content-length', 0), 10);
    fileContentLen += len;
    const bar = new ProgressBar('  downloading [:bar] :rate/bps :percent :etas', {
      complete: '=',
      incomplete: ' ',
      width: 50,
      total: fileContentLen - fileChunkLen,
      renderThrottle: 100,
    });
    res.on('data', chunk => {
      fileChunkLen += chunk.length;
      bar.tick(chunk.length);
    });

    if (status === 404 || (ignoreDownloadStatuses && ignoreDownloadStatuses.includes(status))) {
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
