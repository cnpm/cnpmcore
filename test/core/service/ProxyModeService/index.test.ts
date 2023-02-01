import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from 'test/TestUtil';
import { Registry as RegistryModel } from 'app/repository/model/Registry';
import { PackageManagerService } from 'app/core/service/PackageManagerService';
import { ProxyModeService } from 'app/core/service/ProxyModeService';
import { NFSClientAdapter } from 'app/infra/NFSClientAdapter';
import { calculateIntegrity } from 'app/common/PackageUtil';
import { PROXY_MODE_CACHED_PACKAGE_DIR_NAME } from 'app/common/constants';
import { DIST_NAMES } from 'app/core/entity/Package';

describe('test/core/service/ProxyModeService.test.ts', () => {
  let proxyModeService: ProxyModeService;
  let nfsClientAdapter: NFSClientAdapter;
  beforeEach(async () => {
    proxyModeService = await app.getEggObject(ProxyModeService);
    nfsClientAdapter = await app.getEggObject(NFSClientAdapter);
  });

  describe('initProxyModeRegistry()', () => {
    it('should return default source registry.', async () => {
      const registry = await proxyModeService.initProxyModeRegistry();
      assert(registry?.host === app.config.cnpmcore.sourceRegistry);
    });

    it('should insert default registry into database after init.', async () => {
      await proxyModeService.initProxyModeRegistry();
      const model = await RegistryModel.findOne({ name: 'default' });
      assert(model?.host === app.config.cnpmcore.sourceRegistry);
    });
  });

  describe('get package manifest', () => {
    it('should get package full manifest from source registry and store it to NFS', async () => {
      app.mockHttpclient('https://registry.npmjs.org/foobar', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar.json'),
        persist: false,
      });
      const { data: fullManifest } = await proxyModeService.getPackageFullManifests('foobar');
      const storeKey = `/${PROXY_MODE_CACHED_PACKAGE_DIR_NAME}/foobar/${DIST_NAMES.FULL_MANIFESTS}`;
      const nfsBytes = await nfsClientAdapter.readBytes(storeKey);
      const fullManifestBytes = Buffer.from(JSON.stringify(fullManifest));
      assert((await calculateIntegrity(fullManifestBytes)).shasum === (await calculateIntegrity(nfsBytes!)).shasum);
    });
  });

  describe('getPackageVersionTarAndPublish()', () => {
    let tgzBuffer: Buffer;
    let resBuffer: Buffer | null;
    let packageManagerService: PackageManagerService;
    beforeEach(async () => {
      packageManagerService = await app.getEggObject(PackageManagerService);
      tgzBuffer = await TestUtil.readFixturesFile('registry.npmjs.org/foobar/-/foobar-1.0.0.tgz');
      app.mockHttpclient('https://registry.npmjs.org/foobar/-/foobar-1.0.0.tgz', 'GET', {
        data: tgzBuffer,
        persist: false,
      });
      app.mockHttpclient('https://registry.npmjs.org/foobar', 'GET', {
        data: await TestUtil.readFixturesFile('registry.npmjs.org/foobar.json'),
        persist: false,
      });
      resBuffer = await proxyModeService.getPackageVersionTarAndPublish('foobar', '1.0.0', 'foobar/-/foobar-1.0.0.tgz');
    });

    it('should get the tgz buffer from source registry', async () => {
      assert((await calculateIntegrity(resBuffer!)).shasum === (await calculateIntegrity(tgzBuffer)).shasum);
    });

    it('should publish the specified version to database', async () => {
      const { data: manifests } = await packageManagerService.listPackageFullManifests('', 'foobar');
      assert(manifests);
      assert(manifests.versions['1.0.0']);
      assert(Object.keys(manifests.versions).length === 1);
    });

    it('should sync maintainers when publish', async () => {
      const { data: manifests } = await packageManagerService.listPackageFullManifests('', 'foobar');
      const sourceManifests = JSON.parse((await TestUtil.readFixturesFile('registry.npmjs.org/foobar.json')).toString('utf8'));
      assert(manifests.maintainers.length >= 1);
      assert.deepEqual(manifests.maintainers, sourceManifests.maintainers);
    });

    it('should sync dist-tags when publish', async () => {
      const { data: manifests } = await packageManagerService.listPackageFullManifests('', 'foobar');
      const sourceManifests = JSON.parse((await TestUtil.readFixturesFile('registry.npmjs.org/foobar.json')).toString('utf8'));
      assert(Object.keys(manifests['dist-tags']).length >= 1);
      assert.deepEqual(manifests['dist-tags'], sourceManifests['dist-tags']);
    });
  });
});
