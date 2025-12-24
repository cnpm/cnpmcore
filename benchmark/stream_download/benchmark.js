const urllib = require('urllib');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

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

(async () => {
  while (true) {
    await downloadAndUpload();
  }
})();
