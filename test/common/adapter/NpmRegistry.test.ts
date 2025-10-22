import assert from 'node:assert/strict';

import { app, mock } from '@eggjs/mock/bootstrap';

import { NPMRegistry } from '../../../app/common/adapter/NPMRegistry.ts';

describe('test/common/adapter/CacheAdapter.test.ts', () => {
  let npmRegistry: NPMRegistry;

  beforeEach(async () => {
    npmRegistry = await app.getEggObject(NPMRegistry);
    mock(app.config.cnpmcore, 'registry', 'https://registry.npmjs.org');
  });

  describe('setRegistryHost()', () => {
    it('default registry', async () => {
      assert.ok(npmRegistry.registry === 'https://registry.npmjs.org');
    });
    it('should work', async () => {
      assert.ok(npmRegistry.registry);
      const host = 'https://registry.npmmirror.com';
      npmRegistry.setRegistryHost(host);
      assert.ok(npmRegistry.registry === 'https://registry.npmmirror.com');
    });
  });
});
