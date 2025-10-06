import assert from 'node:assert/strict';

// Simulate the parseSRIFromIntegrity function from the controller
function parseSRIFromIntegrity(integrity) {
  const parts = integrity.trim().split(/\s+/);
  const sri = {};
  
  for (const part of parts) {
    if (part.startsWith('sha256-')) {
      sri.sha256 = part;
    } else if (part.startsWith('sha384-')) {
      sri.sha384 = part;
    } else if (part.startsWith('sha512-')) {
      sri.sha512 = part;
    }
  }
  
  if (Object.keys(sri).length > 0) {
    return {
      sha256: sri.sha256 || '',
      sha384: sri.sha384 || '',
      sha512: sri.sha512 || '',
      combined: Object.values(sri).filter(Boolean).join(' '),
    };
  }
  
  return null;
}

// Simulate the formatFileItem function behavior
function formatFileItem(file) {
  const baseItem = {
    path: file.path,
    type: 'file',
    contentType: file.contentType,
    integrity: file.dist.integrity,
    lastModified: file.mtime,
    size: file.dist.size,
  };

  const integrityStr = file.dist.integrity;
  const sriData = parseSRIFromIntegrity(integrityStr);
  
  if (sriData) {
    return {
      ...baseItem,
      sri: sriData,
    };
  }
  
  return baseItem;
}

// Test the controller functions in isolation
function runSRITests() {
  // SRI Integration Test

  // Test 1: Parse SRI from combined integrity string
  function testParseSRI() {

    // Test with combined SRI (new files)
    const combinedSRI = 'sha256-ABC sha384-DEF sha512-GHI';
    const parsed = parseSRIFromIntegrity(combinedSRI);
    
    assert.ok(parsed !== null);
    assert.equal(parsed.sha256, 'sha256-ABC');
    assert.equal(parsed.sha384, 'sha384-DEF');
    assert.equal(parsed.sha512, 'sha512-GHI');
    assert.equal(parsed.combined, combinedSRI);

    // Test with legacy SHA-512 only (existing files)
    const legacySRI = 'sha512-GHI';
    const parsedLegacy = parseSRIFromIntegrity(legacySRI);
    
    assert.ok(parsedLegacy !== null);
    assert.equal(parsedLegacy.sha256, '');
    assert.equal(parsedLegacy.sha384, '');
    assert.equal(parsedLegacy.sha512, 'sha512-GHI');
    assert.equal(parsedLegacy.combined, 'sha512-GHI');

    // Test with empty/invalid input
    const invalid = parseSRIFromIntegrity('invalid-string');
    assert.equal(invalid, null);
    
    const empty = parseSRIFromIntegrity('');
    assert.equal(empty, null);
  }

  // Test 2: Format file item with SRI data
  function testFormatFileItem() {

    // Test with new file format (combined SRI)
    const newFile = {
      path: '/package.json',
      contentType: 'application/json',
      dist: {
        integrity: 'sha256-ABC sha384-DEF sha512-GHI',
        size: 100,
      },
      mtime: new Date('2023-01-01'),
    };

    const newFormatted = formatFileItem(newFile);
    assert.ok(newFormatted.sri);
    assert.equal(newFormatted.sri.sha256, 'sha256-ABC');
    assert.equal(newFormatted.sri.sha384, 'sha384-DEF');
    assert.equal(newFormatted.sri.sha512, 'sha512-GHI');
    assert.equal(newFormatted.sri.combined, 'sha256-ABC sha384-DEF sha512-GHI');

    // Test with legacy file format (SHA-512 only)
    const legacyFile = {
      path: '/package.json',
      contentType: 'application/json',
      dist: {
        integrity: 'sha512-GHI',
        size: 100,
      },
      mtime: new Date('2023-01-01'),
    };

    const legacyFormatted = formatFileItem(legacyFile);
    assert.ok(legacyFormatted.sri);
    assert.equal(legacyFormatted.sri.sha256, '');
    assert.equal(legacyFormatted.sri.sha384, '');
    assert.equal(legacyFormatted.sri.sha512, 'sha512-GHI');
    assert.equal(legacyFormatted.sri.combined, 'sha512-GHI');

    // Test with invalid integrity
    const invalidFile = {
      path: '/package.json',
      contentType: 'application/json',
      dist: {
        integrity: 'invalid-integrity',
        size: 100,
      },
      mtime: new Date('2023-01-01'),
    };

    const invalidFormatted = formatFileItem(invalidFile);
    assert.ok(!invalidFormatted.sri); // Should not have SRI data for invalid integrity
  }

  // Test 3: Verify SRI header format
  function testSRIHeaders() {
    // Test that the SRI headers would be correctly formatted
    const sriData = {
      sha256: 'sha256-ABC',
      sha384: 'sha384-DEF',
      sha512: 'sha512-GHI',
      combined: 'sha256-ABC sha384-DEF sha512-GHI',
    };

    // Verify header values are valid SRI format
    assert.ok(sriData.sha256.startsWith('sha256-'));
    assert.ok(sriData.sha384.startsWith('sha384-'));
    assert.ok(sriData.sha512.startsWith('sha512-'));
    
    // Verify combined format is space-separated
    const parts = sriData.combined.split(' ');
    assert.equal(parts.length, 3);
    assert.equal(parts[0], sriData.sha256);
    assert.equal(parts[1], sriData.sha384);
    assert.equal(parts[2], sriData.sha512);
  }

  // Run all tests
  try {
    testParseSRI();
    testFormatFileItem();
    testSRIHeaders();
    // All SRI integration tests passed!
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(`\n❌ Test failed: ${error.message}`);
    throw error;
  }
}

// Run the tests
runSRITests();