const urllib = require('urllib');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { setTimeout } = require('timers/promises');

require('./gc.js');

const tmp = path.join(__dirname, 'tmp');
fs.mkdirSync(tmp, { recursive: true });

const BASE_URL = process.argv[2] || 'http://127.0.0.1';
let count = 0;
async function downloadAndUpload() {
  const tmpFilePath = path.join(tmp, `${crypto.randomUUID()}.txt`);
  const downloadResponse = await urllib.request(`${BASE_URL}/download/50mb_ones.txt`, {
    writeStream: fs.createWriteStream(tmpFilePath),
  });
  const uploadResponse = await urllib.request(`${BASE_URL}/upload/`, {
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
