import assert from 'node:assert/strict';
import { gte } from 'semver';

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
  
  describe('fetch() preview tests', () => {
    it('should fetch root directory', async () => {
      app.mockHttpclient('https://archive.mozilla.org/pub/firefox/releases/', 'GET', {
        data: await TestUtil.readFixturesFile(
          'archive.mozilla.org/pub/firefox/releases/index.html'
        ),
        persist: false,
      });

      const result = await binary.fetch('/', 'firefox');
      assert.ok(result);
      assert.ok(result.items.length === 6);
      
      // Create a list of names for easier debugging and validation
      const itemNames = result.items.map(item => item.name);
      const filteredResults = itemNames.filter(name => name.endsWith('/'));
      
      // Check if all expected version directories are present
      assert.ok(filteredResults.includes('130.0/'), `Missing 130.0/ in: [${filteredResults.join(', ')}]`);
      assert.ok(filteredResults.includes('130.0.1/'), `Missing 130.0.1/ in: [${filteredResults.join(', ')}]`);
      assert.ok(filteredResults.includes('131.0/'), `Missing 131.0/ in: [${filteredResults.join(', ')}]`);
      assert.ok(filteredResults.includes('131.0.3/'), `Missing 131.0.3/ in: [${filteredResults.join(', ')}]`);
      
      // Check specific item properties
      assert.ok(result.items[0].name === '130.0/');
      assert.ok(result.items[0].isDir === true);
      assert.ok(result.items[0].date === '01-Oct-2024 19:13');
      assert.ok(result.items[1].name === '130.0.1/');
      assert.ok(result.items[1].isDir === true);
      assert.ok(result.items[4].name === '131.0.3/');
      assert.ok(result.items[4].isDir === true);
      assert.ok(result.items[4].date === '28-Oct-2024 20:13');
    });

    it('should filter out old Firefox versions < 100.0.0', async () => {
      app.mockHttpclient('https://archive.mozilla.org/pub/firefox/releases/', 'GET', {
        data: await TestUtil.readFixturesFile(
          'archive.mozilla.org/pub/firefox/releases/index-with-old-versions.html'
        ),
        persist: false,
      });

      const result = await binary.fetch('/', 'firefox');
      assert.ok(result);
      
      // Should only include versions >= 100.0.0
      const versionDirs = result.items.filter(item => item.isDir);
      const versionNames = new Set(versionDirs.map(item => item.name));
      
      // Should include versions >= 100.0.0
      assert.ok(versionNames.has('100.0/'));
      assert.ok(versionNames.has('130.0/'));
      assert.ok(versionNames.has('131.0/'));
      assert.ok(versionNames.has('131.0b3/')); // Beta versions should be included if >= 100.0.0
      
      // Should exclude versions < 100.0.0
      assert.ok(!versionNames.has('3.6/'));
      assert.ok(!versionNames.has('52.0/'));
      assert.ok(!versionNames.has('78.0/'));
      assert.ok(!versionNames.has('99.0/'));
      
      // All version directories should be >= 100.0.0
      const validVersions = versionDirs.filter(item => {
        const versionName = item.name.slice(0, -1); // Remove trailing '/'
        if (/^\d+\.\d+/.test(versionName)) {
          const cleanVersion = versionName.replace(/[a-zA-Z].*$/, '');
          return cleanVersion >= '100.0';
        }
        return true;
      });
      assert.ok(validVersions.length === versionDirs.length);
    });

    it('should fetch version directory with files', async () => {
      app.mockHttpclient('https://archive.mozilla.org/pub/firefox/releases/131.0.3/', 'GET', {
        data: await TestUtil.readFixturesFile(
          'archive.mozilla.org/pub/firefox/releases/131.0.3.html'
        ),
        persist: false,
      });

      const result = await binary.fetch('/131.0.3/', 'firefox');
      assert.ok(result);
      assert.ok(result.items.length === 7);
      
      // Check directories
      const linuxDir = result.items.find(item => item.name === 'linux-x86_64/');
      assert.ok(linuxDir);
      assert.ok(linuxDir.isDir === true);
      assert.ok(linuxDir.date === '28-Oct-2024 19:58');
      
      const macDir = result.items.find(item => item.name === 'mac/');
      assert.ok(macDir);
      assert.ok(macDir.isDir === true);
      
      // Check files
      const tarFile = result.items.find(item => item.name === 'firefox-131.0.3.tar.bz2');
      assert.ok(tarFile);
      assert.ok(tarFile.isDir === false);
      assert.ok(tarFile.size === '139M');
      assert.ok(tarFile.url === 'https://archive.mozilla.org/pub/firefox/releases/131.0.3/firefox-131.0.3.tar.bz2');
      
      const ascFile = result.items.find(item => item.name === 'firefox-131.0.3.tar.bz2.asc');
      assert.ok(ascFile);
      assert.ok(ascFile.isDir === false);
      assert.ok(ascFile.size === '833');
    });
  });

});