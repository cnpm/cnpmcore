const urllib = require('urllib');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { setTimeout } = require('timers/promises');

async function downloadAndUpload() {
  const tmpFilePath = path.join(__dirname, `${crypto.randomUUID()}.txt`);
  await urllib.request('http://127.0.0.1/download/50mb_ones.txt', {
    writeStream: fs.createWriteStream(tmpFilePath),
  });
  await urllib.request('http://127.0.0.1/upload/', {
    method: 'POST',
    stream: fs.createReadStream(tmpFilePath),
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
