import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { NPMRegistry } from '../../../app/common/adapter/NPMRegistry';

describe('test/common/adapter/CacheAdapter.test.ts', () => {
  let npmRegistry: NPMRegistry;

  beforeEach(async () => {
    npmRegistry = await app.getEggObject(NPMRegistry);
    mock(app.config.cnpmcore, 'registry', 'https://registry.npmjs.org');
  });

  describe('setRegistryHost()', () => {
    it('default registry', async () => {
      assert(npmRegistry.registry === 'https://registry.npmjs.org');
    });
    it('should work', async () => {
      assert(npmRegistry.registry);
      const host = 'https://registry.npmmirror.com';
      npmRegistry.setRegistryHost(host);
      assert(npmRegistry.registry === 'https://registry.npmmirror.com');
    });
  });
});
