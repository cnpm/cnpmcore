import assert from 'node:assert/strict';

import { app } from '@eggjs/mock/bootstrap';

import { FirefoxBinary } from '../../../../app/common/adapter/binary/FirefoxBinary.js';
import { TestUtil } from '../../../../test/TestUtil.js';

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
    it('should fetch root directory', async () => {
      const response = await TestUtil.readFixturesFile('archive.mozilla.org/pub/firefox/releases/index.html');
      app.mockHttpclient(
        /https:\/\/archive\.mozilla\.org\/pub\/firefox\/releases/,
        'GET',
        {
          data: response,
          status: 200,
        }
      );

      const result = await binary.fetch('/', 'firefox');
      assert.ok(result, `Result should not be null/undefined. Got: ${result}`);
      assert.ok(result.items.length > 0, `Result.items should not be empty. Got: ${JSON.stringify(result)}`);
      
      // Create a list of names for easier debugging and validation
      const itemNames = result.items.map(item => item.name);
      const filteredResults = itemNames.filter(name => name.endsWith('/'));
      
      // Check if some expected modern version directories are present (>= 100.0.0)
      assert.ok(filteredResults.includes('100.0/'), `Missing 100.0/ in: [${filteredResults.join(', ')}]`);
      assert.ok(filteredResults.includes('latest/'), `Missing latest/ in: [${filteredResults.join(', ')}]`);
      assert.ok(filteredResults.includes('latest-esr/'), `Missing latest-esr/ in: [${filteredResults.join(', ')}]`);
      
      // Check that old versions are NOT present (< 100.0.0)
      assert.ok(!filteredResults.includes('0.8/'), `0.8/ should be filtered out in: [${filteredResults.join(', ')}]`);
      assert.ok(!filteredResults.includes('1.0/'), `1.0/ should be filtered out in: [${filteredResults.join(', ')}]`);
      assert.ok(!filteredResults.includes('99.0/'), `99.0/ should be filtered out in: [${filteredResults.join(', ')}]`);
      
      // Check that all items are directories and have proper properties
      const dirItems = result.items.filter(item => item.isDir);
      assert.ok(dirItems.length > 10, `Should have modern version directory items. Got: ${dirItems.length}`);
      assert.ok(dirItems.length < 1000, `Should filter out old versions. Got: ${dirItems.length}`);
      
      // Check that all directory items have names ending with '/'
      for (const item of dirItems) {
        assert.ok(item.name.endsWith('/'), `Directory item should end with '/': ${item.name}`);
        assert.ok(item.isDir === true, `Directory item should have isDir=true: ${item.name}`);
      }
    });

    it('should filter out old Firefox versions < 100.0.0', async () => {
      const response = await TestUtil.readFixturesFile('archive.mozilla.org/pub/firefox/releases/index.html');
      app.mockHttpclient(
        /https:\/\/archive\.mozilla\.org\/pub\/firefox\/releases/,
        'GET',
        {
          data: response,
          status: 200,
        }
      );

      const result = await binary.fetch('/', 'firefox');
      assert.ok(result);
      
      // Should only include versions >= 100.0.0
      const versionDirs = result.items.filter(item => item.isDir);
      const versionNames = new Set(versionDirs.map(item => item.name));
      assert.ok(versionNames.size > 0, `versionNames.size should be greater than 0 in: [${Array.from(versionNames).join(', ')}]`);
      
      // Should include versions >= 100.0.0 and special directories  
      assert.ok(versionNames.has('100.0/'), `Missing 100.0/ in: [${Array.from(versionNames).join(', ')}]`);
      assert.ok(versionNames.has('latest/'), `Missing latest/ in: [${Array.from(versionNames).join(', ')}]`);
      assert.ok(versionNames.has('latest-esr/'), `Missing latest-esr/ in: [${Array.from(versionNames).join(', ')}]`);
      
      // Should exclude versions < 100.0.0
      assert.ok(!versionNames.has('3.6/'), `3.6/ should be excluded in: [${Array.from(versionNames).join(', ')}]`);
      assert.ok(!versionNames.has('52.0/'), `52.0/ should be excluded in: [${Array.from(versionNames).join(', ')}]`);
      assert.ok(!versionNames.has('78.0/'), `78.0/ should be excluded in: [${Array.from(versionNames).join(', ')}]`);
      assert.ok(!versionNames.has('99.0/'), `99.0/ should be excluded in: [${Array.from(versionNames).join(', ')}]`);
      
      // All numeric version directories should be >= 100.0.0
      const numericVersions = versionDirs.filter(item => {
        const versionName = item.name.slice(0, -1); // Remove trailing '/'
        return /^\d+\.\d+/.test(versionName);
      });
      
      const validVersions = numericVersions.filter(item => {
        const versionName = item.name.slice(0, -1); // Remove trailing '/'
        const major = Number.parseInt(versionName.split('.')[0]);
        return major >= 100;
      });
      assert.ok(validVersions.length === numericVersions.length,
        `All numeric versions should be >= 100.0.0. Found ${validVersions.length} valid out of ${numericVersions.length} total`);
    });

    it('should fetch version directory with files', async () => {
      const response = await TestUtil.readFixturesFile('archive.mozilla.org/pub/firefox/releases/131.0.3.html');
      app.mockHttpclient(
        /https:\/\/archive\.mozilla\.org\/pub\/firefox\/releases\/131\.0\.3/,
        'GET',
        {
          data: response,
          status: 200,
        }
      );

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