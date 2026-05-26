require('ts-node/register');
require('tsconfig-paths/register');

const { importResolve } = require('@eggjs/utils');
const path = require('path');

console.log('--- Test 1: importResolve absolute .js path (file is .ts) ---');
const target = path.join(__dirname, 'app/port/schedule/SavePackageVersionDownloadCounter.js');
console.log('Target:', target);
console.log('Exists?', require('fs').existsSync(target));
try {
  const r = importResolve(target);
  console.log('OK:', r);
} catch (e) {
  console.log('FAIL:', e.constructor.name, '-', e.message.split('\n')[0]);
}

console.log('\n--- Test 2: require.resolve same path ---');
try {
  const r = require.resolve(target);
  console.log('OK:', r);
} catch (e) {
  console.log('FAIL:', e.constructor.name, '-', e.message.split('\n')[0]);
}
