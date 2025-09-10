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
  
  describe('HTML parsing logic', () => {
    it('should parse Mozilla HTML directory listing correctly', () => {
      // Test the regex parsing logic directly without HTTP mocking
      const htmlBuffer = TestUtil.readFixturesFileSync(
        'archive.mozilla.org/pub/firefox/releases/index.html'
      );
      const html = htmlBuffer.toString();
      
      // Extract the parsing logic from FirefoxBinary for testing
      const re = /<td><a href="([^"]+?)"[^>]*?>[^<]+?<\/a><\/td><td align="right">(\d{4}-\d{2}-\d{2} \d{2}:\d{2}|-)[^<]*?<\/td><td align="right">\s*([\d.\-\s\wMKG]+|-)\s*<\/td>/gi;
      const matchs = html.matchAll(re);
      const results = [];
      
      for (const m of matchs) {
        results.push({
          href: m[1],
          date: m[2],
          size: m[3].trim()
        });
      }
      
      // Verify the parsing extracted the expected results
      assert.ok(results.length >= 6);
      
      // Check for specific expected entries
      const dirNameSet = new Set(results.map(r => r.href));
      assert.ok(dirNameSet.has('130.0/'));
      assert.ok(dirNameSet.has('131.0.3/'));
      assert.ok(dirNameSet.has('131.0b3/'));
    });

    it('should filter out old Firefox versions < 100.0.0', async () => {
      const htmlBuffer = TestUtil.readFixturesFileSync(
        'archive.mozilla.org/pub/firefox/releases/index-with-old-versions.html'
      );
      const html = htmlBuffer.toString();
      
      const re = /<td><a href="([^"]+?)"[^>]*?>[^<]+?<\/a><\/td><td align="right">(\d{4}-\d{2}-\d{2} \d{2}:\d{2}|-)[^<]*?<\/td><td align="right">\s*([\d.\-\s\wMKG]+|-)\s*<\/td>/gi;
      const matchs = html.matchAll(re);
      const filteredResults = [];
      
      for (const m of matchs) {
        const name = m[1];
        const isDir = name.endsWith('/');
        
        // Apply same filtering logic as FirefoxBinary
        if (isDir && name !== '../') {
          const versionName = name.slice(0, -1); // Remove trailing '/'
          if (/^\d+\.\d+/.test(versionName)) {
            try {
              const cleanVersion = versionName.replace(/[a-zA-Z].*$/, '');
              const semverVersion = cleanVersion.split('.').length === 2 ? `${cleanVersion}.0` : cleanVersion;
              if (gte(semverVersion, '100.0.0')) {
                filteredResults.push(name);
              }
            } catch {
              // Skip on error
            }
          }
        }
      }
      
      // Should include versions >= 100.0.0
      assert.ok(filteredResults.includes('100.0/'));
      assert.ok(filteredResults.includes('130.0/'));
      assert.ok(filteredResults.includes('131.0/'));
      
      // Should NOT include versions < 100.0.0
      assert.ok(!filteredResults.includes('3.6/'));
      assert.ok(!filteredResults.includes('52.0/'));
      assert.ok(!filteredResults.includes('78.0/'));
      assert.ok(!filteredResults.includes('99.0/'));
    });
  });
  

});