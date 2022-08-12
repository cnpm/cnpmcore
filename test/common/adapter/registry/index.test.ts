import assert = require('assert');
import { getRegistryAdapter } from 'app/common/adapter/registry/index';


describe('test/common/adapter/registry/index.test.ts', () => {
  it('should get registry success', async () => {
    ['npm', 'cnpmcore', 'cnpmjsorg'].forEach((type) => {
      const adapter = getRegistryAdapter({ type } as any);
      assert(adapter);
    });
  });
  it('should throw error when unkonwn type', async () => {
    assert.throws(() => {
      return getRegistryAdapter({ type: 'unknown' } as any);
    }, /Registry type unknown not supported/);
  });
});
