import assert from 'node:assert/strict';

import { app, mock } from '@eggjs/mock/bootstrap';

import { NPMRegistry } from '../../../app/common/adapter/NPMRegistry.ts';

describe('test/common/adapter/CacheAdapter.test.ts', () => {
  let npmRegistry: NPMRegistry;

  beforeEach(async () => {
    npmRegistry = await app.getEggObject(NPMRegistry);
    mock(app.config.cnpmcore, 'registry', 'https://registry.npmjs.org');
  });

  describe('createSyncTask()', () => {
    it('should forward selected versions to the upstream modern sync API', async () => {
      const specificVersions = ['2.0.0', '2.0.0-runtime-linux-x64'];
      app
        .mockAgent()
        .get('https://registry.npmjs.org')
        .intercept({
          method: 'PUT',
          path: '/-/package/%40example%2Fapp/syncs',
          body: JSON.stringify({ skipDependencies: true, specificVersions: JSON.stringify(specificVersions) }),
          headers: { authorization: 'Bearer test-upstream-token' },
        })
        .reply(201, { ok: true, id: 'selected-task' });
      const result = await npmRegistry.createSyncTask('@example/app', {
        remoteAuthToken: 'test-upstream-token',
        specificVersions,
      });
      assert.equal(result.data.logId, 'selected-task');
      app.mockAgent().assertNoPendingInterceptors();
    });

    it('should retain the legacy upstream request for full synchronization', async () => {
      app.mockHttpclient('https://registry.npmjs.org/example/sync?sync_upstream=true&nodeps=true', 'PUT', {
        data: { ok: true, logId: 'full-task' },
        persist: false,
      });
      const result = await npmRegistry.createSyncTask('example');
      assert.equal(result.data.logId, 'full-task');
      app.mockAgent().assertNoPendingInterceptors();
    });
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
