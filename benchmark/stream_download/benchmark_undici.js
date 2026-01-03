const { request } = require('undici');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { pipeline } = require('stream/promises');

async function downloadAndUpload() {
  const tmpFilePath = path.join(__dirname, `${crypto.randomUUID()}.txt`);

  // Download file
  const downloadResponse = await request('http://127.0.0.1/download/50mb_ones.txt');
  await pipeline(downloadResponse.body, fs.createWriteStream(tmpFilePath));

  // Upload file
  await request('http://127.0.0.1/upload/', {
    method: 'POST',
    body: fs.createReadStream(tmpFilePath),
  });

  await fs.promises.rm(tmpFilePath);
}

let downloading = true;
(async () => {
  while (true) {
    if (downloading) {
      await downloadAndUpload();
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
