const { HttpClient } = require('urllib');
const { Agent } = require('undici');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { setTimeout } = require('timers/promises');

require('./gc.js');

const tmp = path.join(__dirname, 'tmp');
fs.mkdirSync(tmp, { recursive: true });

const BASE_URL = process.argv[2] || 'http://127.0.0.1';

// Create HttpClient with smaller connection pool
const POOL_SIZE = parseInt(process.env.POOL_SIZE || '2', 10);
const agent = new Agent({
  connections: POOL_SIZE, // Max connections per origin
  pipelining: 1, // Disable pipelining
  keepAliveTimeout: 4000, // 4 seconds
  keepAliveMaxTimeout: 10000, // 10 seconds max
});
const httpClient = new HttpClient();
httpClient.setDispatcher(agent);

console.log(`Using connection pool size: ${POOL_SIZE}`);
let count = 0;
async function downloadAndUpload() {
  const tmpFilePath = path.join(tmp, `${crypto.randomUUID()}.txt`);
  const downloadResponse = await httpClient.request(`${BASE_URL}/download/50mb_ones.txt`, {
    writeStream: fs.createWriteStream(tmpFilePath),
  });
  const uploadResponse = await httpClient.request(`${BASE_URL}/upload/`, {
    method: 'POST',
    stream: fs.createReadStream(tmpFilePath),
  });
  await fs.promises.rm(tmpFilePath);
  count++;
  if (count % 100 === 0) {
    console.log(
      `Downloaded and uploaded ${count} times, downloadResponse: ${downloadResponse.status}, uploadResponse: ${uploadResponse.status}`,
    );
  }
}

let downloading = true;
(async () => {
  while (true) {
    if (downloading) {
      await Promise.all([downloadAndUpload(), downloadAndUpload(), downloadAndUpload()]);
    } else {
      await setTimeout(100);
      if (globalThis.gc) {
        globalThis.gc();
      }
    }
  }
})();
(async () => {
  while (true) {
    if (downloading) {
      await Promise.all([downloadAndUpload(), downloadAndUpload(), downloadAndUpload()]);
    } else {
      await setTimeout(100);
      if (globalThis.gc) {
        globalThis.gc();
      }
    }
  }
})();

process.on('SIGUSR2', () => {
  downloading = !downloading;
});
