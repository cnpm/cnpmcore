import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import { FirefoxBinary } from '../../../../app/common/adapter/binary/FirefoxBinary.ts';
import { TestUtil } from '../../../../test/TestUtil.ts';

describe('test/common/adapter/binary/FirefoxBinary.test.ts', () => {
  let binary: FirefoxBinary;
  beforeEach(async () => {
    binary = await app.getEggObject(FirefoxBinary);
  });

  it('should create binary instance', () => {
    assert.ok(binary);
    assert.ok(typeof binary.fetch === 'function');
  });

  describe('fetch()', () => {
    it('should fetch root directory using product-details JSON API', async () => {
      const response = await TestUtil.readFixturesFile('product-details.mozilla.org/1.0/firefox.json');
      app.mockHttpclient(/https:\/\/product-details\.mozilla\.org\/1\.0\/firefox\.json/, 'GET', {
        data: response,
        status: 200,
      });

      const result = await binary.fetch('/', 'firefox');
      assert.ok(result, `Result should not be null/undefined. Got: ${result}`);
      assert.ok(result.items.length > 0, `Result.items should not be empty. Got: ${JSON.stringify(result)}`);

      const itemNames = result.items.map(item => item.name);
      const filteredResults = itemNames.filter(name => name.endsWith('/'));

      // Check if some expected modern version directories are present (>= 100.0.0)
      assert.ok(filteredResults.includes('100.0/'), `Missing 100.0/ in: [${filteredResults.join(', ')}]`);
      assert.ok(filteredResults.includes('147.0.4/'), `Missing 147.0.4/ in: [${filteredResults.join(', ')}]`);
      assert.ok(filteredResults.includes('latest/'), `Missing latest/ in: [${filteredResults.join(', ')}]`);
      assert.ok(filteredResults.includes('latest-esr/'), `Missing latest-esr/ in: [${filteredResults.join(', ')}]`);
      assert.ok(filteredResults.includes('latest-beta/'), `Missing latest-beta/ in: [${filteredResults.join(', ')}]`);

      // Check that old versions are NOT present (< 100.0.0)
      assert.ok(!filteredResults.includes('3.6/'), `3.6/ should be filtered out in: [${filteredResults.join(', ')}]`);
      assert.ok(!filteredResults.includes('52.0/'), `52.0/ should be filtered out in: [${filteredResults.join(', ')}]`);
      assert.ok(!filteredResults.includes('78.0/'), `78.0/ should be filtered out in: [${filteredResults.join(', ')}]`);
      assert.ok(!filteredResults.includes('99.0/'), `99.0/ should be filtered out in: [${filteredResults.join(', ')}]`);

      // Check that all items are directories and have proper properties
      const dirItems = result.items.filter(item => item.isDir);
      assert.ok(dirItems.length > 10, `Should have modern version directory items. Got: ${dirItems.length}`);

      for (const item of dirItems) {
        assert.ok(item.name.endsWith('/'), `Directory item should end with '/': ${item.name}`);
        assert.ok(item.isDir === true, `Directory item should have isDir=true: ${item.name}`);
      }
    });

    it('should filter out old Firefox versions < 100.0.0 from JSON API', async () => {
      const response = await TestUtil.readFixturesFile('product-details.mozilla.org/1.0/firefox.json');
      app.mockHttpclient(/https:\/\/product-details\.mozilla\.org\/1\.0\/firefox\.json/, 'GET', {
        data: response,
        status: 200,
      });

      const result = await binary.fetch('/', 'firefox');
      assert.ok(result);

      const versionDirs = result.items.filter(item => item.isDir);
      const versionNames = new Set(versionDirs.map(item => item.name));

      // Should exclude versions < 100.0.0
      assert.ok(!versionNames.has('3.6/'), `3.6/ should be excluded`);
      assert.ok(!versionNames.has('52.0/'), `52.0/ should be excluded`);
      assert.ok(!versionNames.has('78.0/'), `78.0/ should be excluded`);
      assert.ok(!versionNames.has('99.0/'), `99.0/ should be excluded`);
      assert.ok(!versionNames.has('99.0.1/'), `99.0.1/ should be excluded`);

      // All numeric version directories should be >= 100.0.0
      const numericVersions = versionDirs.filter(item => {
        const versionName = item.name.slice(0, -1);
        return /^\d+/.test(versionName);
      });

      for (const item of numericVersions) {
        const versionName = item.name.slice(0, -1);
        const major = Number.parseInt(versionName.split('.')[0]);
        assert.ok(major >= 100, `Version ${versionName} should have major >= 100`);
      }
    });

    it('should fetch version directory with files', async () => {
      const response = await TestUtil.readFixturesFile('archive.mozilla.org/pub/firefox/releases/131.0.3.html');
      app.mockHttpclient(/https:\/\/archive\.mozilla\.org\/pub\/firefox\/releases\/131\.0\.3/, 'GET', {
        data: response,
        status: 200,
      });

      const result = await binary.fetch('/131.0.3/', 'firefox');
      assert.ok(result);
      assert.equal(result.items.length, 19);

      // Check directories
      const linuxDir = result.items.find(item => item.name === 'linux-x86_64/');
      assert.ok(linuxDir);
      assert.equal(linuxDir.isDir, true);
      assert.equal(linuxDir.date, '-');

      const macDir = result.items.find(item => item.name === 'mac/');
      assert.ok(macDir);
      assert.equal(macDir.isDir, true);
      assert.equal(macDir.date, '-');

      // Check files
      const tarFile = result.items.find(item => item.name === 'SHA256SUMS.asc');
      assert.ok(tarFile);
      assert.equal(tarFile.isDir, false);
      assert.equal(tarFile.size, '833');
      assert.equal(tarFile.date, '12-Apr-2025 08:52');
      assert.equal(tarFile.url, 'https://archive.mozilla.org/pub/firefox/releases/131.0.3/SHA256SUMS.asc');
    });
  });
});
