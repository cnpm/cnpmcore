import assert from 'node:assert/strict';
import { RemovePackageVersionController } from '../../../../app/port/controller/package/RemovePackageVersionController';
import { UserRoleManager } from '../../../../app/port/UserRoleManager';

describe('admin force unpublish', () => {
  for (const route of [ 'tarball', 'package' ]) {
    for (const scenario of [
      { name: 'admin with force', user: 'admin', force: 'true', allowed: true },
      { name: 'admin without force', user: 'admin', force: '', allowed: false },
      { name: 'maintainer with force', user: 'maintainer', force: 'true', allowed: false },
      { name: 'readonly admin with force', user: 'admin', force: 'true', readonly: true, allowed: false },
      { name: 'false force flag', user: 'admin', force: 'false', allowed: false },
      { name: 'non-boolean force flag', user: 'admin', force: '1', allowed: false },
      { name: 'before 72 hours', user: 'maintainer', force: '', age: 71, allowed: true },
      { name: 'at 72 hours without force', user: 'admin', force: '', age: 72, allowed: false },
      { name: 'public package', user: 'admin', force: '', isPrivate: false, allowed: true },
    ]) {
      it(`${route}: ${scenario.name}`, async () => {
        const pkg = { fullname: '@example/demo', packageId: 'pkg', isPrivate: scenario.isPrivate !== false };
        const version = { version: '1.0.0', packageVersionId: 'version', publishTime: new Date(Date.now() - (scenario.age ?? 100) * 3600000) };
        let removed = false;
        const roleManager = new UserRoleManager();
        Object.assign(roleManager, {
          config: { cnpmcore: { admins: { admin: true } } },
          async getAuthorizedUserAndToken() {
            return { user: { name: scenario.user }, token: { isReadonly: scenario.readonly } };
          },
        });
        const controller = new RemovePackageVersionController();
        Object.assign(controller, {
          userRoleManager: roleManager,
          async ensurePublishAccess() { return { pkg }; },
          getAndCheckVersionFromFilename() { return version.version; },
          async getPackageVersionEntity() { return version; },
          packageRepository: {
            async findPackageTag() { return { version: version.version }; },
            async findPackageVersion() { return version; },
          },
          packageManagerService: {
            async removePackageVersion(actualPkg: unknown, actualVersion: unknown) {
              assert.equal(actualPkg, pkg);
              assert.equal(actualVersion, version);
              removed = true;
            },
          },
          logger: { info() { /* no logging */ } },
        });
        const headers: Record<string, string> = { 'npm-command': 'unpublish', 'npm-force': scenario.force };
        const ctx = { get: (name: string) => headers[name] || '' } as any;
        const run = () => (route === 'tarball'
          ? controller.removeByTarballUrl(ctx, pkg.fullname, 'demo-1.0.0')
          : controller.removeByPkgUri(ctx, pkg.fullname));
        if (scenario.allowed) {
          assert.deepEqual(await run(), { ok: true });
        } else {
          await assert.rejects(run(), /unpublish is not allowed after 72 hours/);
        }
        assert.equal(removed, scenario.allowed);
      });
    }
  }
});
