import assert from 'node:assert/strict';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { calculateIntegrity } from '../../../app/common/PackageUtil.js';

describe('test/common/PackageUtil/calculateIntegrity.test.ts', () => {
  describe('calculateIntegrity()', () => {
    it('should calculate SRI for binary data', async () => {
      const testData = new TextEncoder().encode('Hello, World!');
      const result = await calculateIntegrity(testData);
      
      // Should maintain backwards compatibility
      assert.ok(typeof result.integrity === 'string');
      assert.ok(typeof result.shasum === 'string');
      assert.ok(result.integrity.startsWith('sha512-'));
      
      // Should include enhanced SRI data
      assert.ok(typeof result.sri === 'object');
      assert.ok(typeof result.sri.sha256 === 'string');
      assert.ok(typeof result.sri.sha384 === 'string');
      assert.ok(typeof result.sri.sha512 === 'string');
      assert.ok(typeof result.sri.combined === 'string');
      
      // Verify individual algorithms
      assert.ok(result.sri.sha256.startsWith('sha256-'));
      assert.ok(result.sri.sha384.startsWith('sha384-'));
      assert.ok(result.sri.sha512.startsWith('sha512-'));
      
      // Combined should contain all three algorithms
      assert.ok(result.sri.combined.includes('sha256-'));
      assert.ok(result.sri.combined.includes('sha384-'));
      assert.ok(result.sri.combined.includes('sha512-'));
      
      // Combined should be space-separated
      const parts = result.sri.combined.split(' ');
      assert.equal(parts.length, 3);
      
      // Backwards compatibility: primary integrity should match SHA-512
      assert.equal(result.integrity, result.sri.sha512);
    });

    it('should calculate SRI for file', async () => {
      const testFile = join(tmpdir(), `test-sri-${Date.now()}.txt`);
      const testContent = 'Test file content for SRI calculation';
      
      try {
        await writeFile(testFile, testContent, 'utf8');
        const result = await calculateIntegrity(testFile);
        
        // Should have all required fields
        assert.ok(typeof result.integrity === 'string');
        assert.ok(typeof result.shasum === 'string');
        assert.ok(typeof result.sri === 'object');
        
        // Should be deterministic
        const result2 = await calculateIntegrity(testFile);
        assert.equal(result.integrity, result2.integrity);
        assert.equal(result.shasum, result2.shasum);
        assert.equal(result.sri.sha256, result2.sri.sha256);
        assert.equal(result.sri.sha384, result2.sri.sha384);
        assert.equal(result.sri.sha512, result2.sri.sha512);
        assert.equal(result.sri.combined, result2.sri.combined);
      } finally {
        await unlink(testFile).catch(() => { /* ignore errors */ });
      }
    });

    it('should produce consistent results between binary and file', async () => {
      const testContent = 'Consistency test content';
      const testData = new TextEncoder().encode(testContent);
      const testFile = join(tmpdir(), `test-sri-consistency-${Date.now()}.txt`);
      
      try {
        await writeFile(testFile, testContent, 'utf8');
        
        const binaryResult = await calculateIntegrity(testData);
        const fileResult = await calculateIntegrity(testFile);
        
        // Results should be identical
        assert.equal(binaryResult.integrity, fileResult.integrity);
        assert.equal(binaryResult.shasum, fileResult.shasum);
        assert.equal(binaryResult.sri.sha256, fileResult.sri.sha256);
        assert.equal(binaryResult.sri.sha384, fileResult.sri.sha384);
        assert.equal(binaryResult.sri.sha512, fileResult.sri.sha512);
        assert.equal(binaryResult.sri.combined, fileResult.sri.combined);
      } finally {
        await unlink(testFile).catch(() => { /* ignore errors */ });
      }
    });

    it('should handle empty data', async () => {
      const emptyData = new Uint8Array(0);
      const result = await calculateIntegrity(emptyData);
      
      assert.ok(typeof result.integrity === 'string');
      assert.ok(typeof result.shasum === 'string');
      assert.ok(typeof result.sri === 'object');
      assert.ok(result.sri.sha256.startsWith('sha256-'));
      assert.ok(result.sri.sha384.startsWith('sha384-'));
      assert.ok(result.sri.sha512.startsWith('sha512-'));
    });
  });
});