import { strict as assert } from 'node:assert';
import { app, mock } from 'egg-mock/bootstrap';
import npa from 'npm-package-arg';

import { Package as PackageModel } from '../../../app/repository/model/Package';
import { PackageVersion as CnpmPackageVersionModel } from '../../../app//repository/model/PackageVersion';
import { PackageTag as PackageTagModel } from '../../../app/repository/model/PackageTag';
import { PackageVersionBlock as PackageVersionBlockModel } from '../../../app/repository/model/PackageVersionBlock';
import { PackageVersionService } from '../../../app/core/service/PackageVersionService';
import { PaddingSemVer } from '../../../app/core/entity/PaddingSemVer';
import { BugVersionService } from '../../../app/core/service/BugVersionService';
import { BugVersion } from '../../../app/core/entity/BugVersion';
import { PackageVersionRepository } from '../../../app/repository/PackageVersionRepository';
import { DistRepository } from '../../../app/repository/DistRepository';

describe('test/core/service/PackageVersionService.test.ts', () => {

  let distRepository: DistRepository;
  let packageVersionService: PackageVersionService;
  let bugVersionService: BugVersionService;
  let packageVersionRepository: PackageVersionRepository;

  beforeEach(async () => {
    await app.ready();


    await PackageModel.create({
      createdAt: new Date(),
      updatedAt: new Date(),
      packageId: 'mock_package_id',
      scope: '',
      name: 'mock_package',
      isPrivate: false,
      description: 'mock desc',
      abbreviatedsDistId: 'mock_abbreviated_dist_id',
      manifestsDistId: 'mock_manifest_dist_id',
    });

    await CnpmPackageVersionModel.create({
      packageId: 'mock_package_id',
      packageVersionId: 'mock_package_1.0.0',
      version: '1.0.0',
      abbreviatedDistId: 'mock_abbreviated_dist_id',
      manifestDistId: 'mock_manifest_dist_id',
      tarDistId: 'mock_tar_dist_id',
      readmeDistId: 'mock_readme_dist_id',
      publishTime: new Date(),
    });

    await PackageTagModel.create({
      packageId: 'mock_package_id',
      packageTagId: 'mock_package_tag_id',
      tag: 'latest',
      version: '1.0.0',
    });

    distRepository = await app.getEggObject(DistRepository);
    packageVersionService = await app.getEggObject(PackageVersionService);
    bugVersionService = await app.getEggObject(BugVersionService);
    packageVersionRepository = await app.getEggObject(PackageVersionRepository);

    mock(distRepository, 'findPackageVersionManifest', async (_: string, version: string) => {
      if (version === '1.0.0') {
        return {
          name: 'mock_package',
          version: '1.0.0',
        };
      }
      if (version === '1.1.3') {
        return {
          name: 'mock_package',
          version: '1.1.3',
        };
      }
    });
  });

  afterEach(async () => {
    await PackageModel.truncate();
    await PackageTagModel.truncate();
    await CnpmPackageVersionModel.truncate();
    await PackageVersionBlockModel.truncate();
    mock.restore();
  });

  describe('getPackageManifest', () => {
    describe('version middlewares', () => {
      describe('hit wildcard', () => {

        beforeEach(async () => {

          // 1.1.0
          await CnpmPackageVersionModel.create({
            packageId: 'mock_package_id',
            packageVersionId: 'mock_1.1.0',
            version: '1.1.0',
            abbreviatedDistId: 'mock_2',
            manifestDistId: 'mock_manifest_id_2',
            tarDistId: 'mock_tar_dist_id_2',
            readmeDistId: 'mock_readme_dist_id_2',
            publishTime: new Date(),
          });

          mock(distRepository, 'findPackageVersionManifest', async (_: string, version: string) => {
            assert.equal(version, '1.1.0');
            return {
              name: 'mock_package',
              version: '1.1.0',
            };
          });

        });

        it('should return latest for *', async () => {
          const manifest = await packageVersionService.readManifest('mock_package_id', npa('mock_package@*'), true);
          assert(manifest);
          assert.equal(manifest.version, '1.1.0');
        });

        describe('getVersion should work', () => {
          it('should work without options', async () => {
            const wildVersion = await packageVersionService.getVersion(npa('mock_package@*'));
            const tagVersion = await packageVersionService.getVersion(npa('mock_package@latest'));
            assert.equal(wildVersion, '1.1.0');
            assert.equal(tagVersion, '1.0.0');
          });
        });

        it('should return latest for x', async () => {
          const manifest = await packageVersionService.readManifest('mock_package_id', npa('mock_package@*'), true);
          assert(manifest);
          assert.equal(manifest.version, '1.1.0');
        });

        it('should return latest for compose', async () => {
          const manifest = await packageVersionService.readManifest('mock_package_id', npa('mock_package@^*||~x'), true);
          assert(manifest);
          assert.equal(manifest.version, '1.1.0');
        });
      });
    });

    describe('hit bug version', () => {
      beforeEach(async () => {
        await CnpmPackageVersionModel.create({
          packageId: 'mock_package_id',
          packageVersionId: 'mock_2',
          version: '0.0.9',
          abbreviatedDistId: 'mock_2',
          manifestDistId: 'mock_manifest_id_2',
          tarDistId: 'mock_tar_dist_id_2',
          readmeDistId: 'mock_readme_dist_id_2',
          publishTime: new Date(),
        });

        mock(distRepository, 'findPackageVersionManifest', async (_: string, version: string) => {
          assert(version === '0.0.9');
          return {
            name: 'mock_package',
            version: '0.0.9',
          };
        });
        mock(bugVersionService, 'getBugVersion', async () => {
          return new BugVersion({
            mock_package: {
              '1.0.0': {
                version: '0.0.9',
                reason: 'mock bug version',
              },
            },
          });
        });
      });

      it('should work', async () => {
        const manifest = await packageVersionService.readManifest('mock_package_id', npa('mock_package@latest'), true);
        assert(manifest);
        assert.equal(manifest.deprecated, '[WARNING] Use 0.0.9 instead of 1.0.0, reason: mock bug version');
      });


    });

    describe('hit range resolution', () => {
      beforeEach(async () => {
        await CnpmPackageVersionModel.create({
          packageId: 'mock_package_id',
          packageVersionId: 'mock_3',
          version: '0.0.9',
          abbreviatedDistId: 'mock_3',
          manifestDistId: 'mock_manifest_id_3',
          tarDistId: 'mock_tar_dist_id_3',
          readmeDistId: 'mock_readme_dist_id_3',
          publishTime: new Date(),
        });

        await CnpmPackageVersionModel.create({
          packageId: 'mock_package_id',
          packageVersionId: 'mock_4',
          version: '0.0.10',
          abbreviatedDistId: 'mock_4',
          manifestDistId: 'mock_manifest_id_4',
          tarDistId: 'mock_tar_dist_id_4',
          readmeDistId: 'mock_readme_dist_id_4',
          publishTime: new Date(),
        });

        mock(distRepository, 'findPackageVersionManifest', async (_: string, version: string) => {
          if (version === '0.0.9') {
            return {
              name: 'mock_package',
              version: '0.0.9',
            };
          } else if (version === '0.0.10') {
            return {
              name: 'mock_package',
              version: '0.0.10',
            };
          }
        });
        mock(bugVersionService, 'getBugVersion', () => {
          return new BugVersion({});
        });
      });

      afterEach(async () => {
        await CnpmPackageVersionModel.truncate();
        await CnpmPackageVersionModel.truncate();
      });

    });

    describe('hit tag resolution', () => {
      beforeEach(async () => {
        await CnpmPackageVersionModel.create({
          packageId: 'mock_package_id',
          packageVersionId: 'mock_5',
          version: '0.0.9',
          abbreviatedDistId: 'mock_5',
          manifestDistId: 'mock_manifest_id_5',
          tarDistId: 'mock_tar_dist_id_5',
          readmeDistId: 'mock_readme_dist_id_5',
          publishTime: new Date(),
        });
        await PackageTagModel.create({
          packageId: 'mock_package_id',
          packageTagId: 'mock_package_tag_id_1.23',
          tag: 'beta',
          version: '0.0.9',
        });

        mock(distRepository, 'findPackageVersionManifest', async (_: string, version: string) => {
          assert(version === '0.0.9');
          return {
            name: 'mock_package',
            version: '0.0.9',
          };
        });
        mock(bugVersionService, 'getBugVersion', () => {
          return new BugVersion({});
        });
      });

      afterEach(async () => {
        await CnpmPackageVersionModel.truncate();
      });

    });

    describe('semver', () => {
      beforeEach(async () => {

        await CnpmPackageVersionModel.create({
          packageId: 'mock_package_id',
          packageVersionId: 'mock_2',
          version: '2.0.0',
          abbreviatedDistId: 'mock_2',
          manifestDistId: 'mock_manifest_id_2',
          tarDistId: 'mock_tar_dist_id_2',
          readmeDistId: 'mock_readme_dist_id_2',
          publishTime: new Date(),
        });

        await CnpmPackageVersionModel.create({
          packageId: 'mock_package_id',
          packageVersionId: 'mock_3',
          version: '2.2.0',
          abbreviatedDistId: 'mock_3',
          manifestDistId: 'mock_manifest_id_2',
          tarDistId: 'mock_tar_dist_id_2',
          readmeDistId: 'mock_readme_dist_id_2',
          publishTime: new Date(),
        });

        mock(distRepository, 'findPackageVersionManifest', async (_: string, version: string) => {
          if (version === '2.2.0') {
            return {
              name: 'mock_package',
              version: '2.2.0',
            };
          }
          if (version === '1.0.0') {
            return {
              name: 'mock_package',
              version: '1.0.0',
            };
          }
        });


      });

      describe('should return latest tag', () => {
        it('should work', async () => {
          const manifest = await packageVersionService.readManifest('mock_package_id', npa('mock_package@^1.0.0'), true);
          assert(manifest);
          assert(manifest.version === '1.0.0');
        });
      });

      describe('2.x', () => {
        it('should return major latest tag', async () => {
          const manifest = await packageVersionService.readManifest('mock_package_id', npa('mock_package@^2.0.0'), true);
          assert(manifest);
          assert(manifest.version === '2.2.0');
        });
      });

    });
  });

  describe('get alias', () => {
    it('should work', async () => {
      const manifest = await packageVersionService.readManifest('mock_package_id', npa('mock_package_alias@npm:mock_package@^1.0.0'), true);
      assert.deepStrictEqual(manifest, {
        name: 'mock_package',
        version: '1.0.0',
      });
    });
  });

  describe('get tag', () => {
    it('should work', async () => {
      const manifest = await packageVersionService.readManifest('mock_package_id', npa('mock_package@latest'), true);
      assert.deepStrictEqual(manifest, {
        name: 'mock_package',
        version: '1.0.0',
      });
    });

    it('should work for range tag', async () => {

      await CnpmPackageVersionModel.create({
        packageId: 'mock_package_id',
        packageVersionId: 'mock_package_1.1.3',
        version: '1.1.3',
        abbreviatedDistId: 'mock_abbreviated_dist_id',
        manifestDistId: 'mock_manifest_dist_id',
        tarDistId: 'mock_tar_dist_id',
        readmeDistId: 'mock_readme_dist_id',
        publishTime: new Date(),
      });

      await CnpmPackageVersionModel.create({
        packageId: 'mock_package_id',
        packageVersionId: 'mock_package_1.1.4',
        version: '1.1.4',
        abbreviatedDistId: 'mock_abbreviated_dist_id',
        manifestDistId: 'mock_manifest_dist_id',
        tarDistId: 'mock_tar_dist_id',
        readmeDistId: 'mock_readme_dist_id',
        publishTime: new Date(),
      });

      await PackageTagModel.create({
        packageId: 'mock_package_id',
        packageTagId: 'mock_package_tag_1.1',
        tag: '1.1',
        version: '1.1.3',
      });

      const manifest = await packageVersionService.readManifest('mock_package_id', npa('mock_package@1.1'), true);
      assert.deepStrictEqual(manifest, {
        name: 'mock_package',
        version: '1.1.3',
      });
    });
  });

  describe('get version', () => {
    it('should work', async () => {
      const manifest = await packageVersionService.readManifest('mock_package_id', npa('mock_package@1.0.0'), true);
      assert.deepStrictEqual(manifest, {
        name: 'mock_package',
        version: '1.0.0',
      });
    });
  });

  describe('get range', () => {
    it('should work', async () => {
      const manifest = await packageVersionService.readManifest('mock_package_id', npa('mock_package@^1.0.0'), true);
      assert.deepStrictEqual(manifest, {
        name: 'mock_package',
        version: '1.0.0',
      });
    });

    it('should work for equal range', async () => {
      const manifest = await packageVersionService.readManifest('mock_package_id', npa('mock_package@=1.0.0'), true);
      assert.deepStrictEqual(manifest, {
        name: 'mock_package',
        version: '1.0.0',
      });
    });

    it('should support maxSatisfying', async () => {

      // 17.0.18
      await CnpmPackageVersionModel.create({
        packageId: 'mock_package_id',
        packageVersionId: 'mock_package_17.0.18',
        version: '17.0.18',
        abbreviatedDistId: 'mock_abbreviated_dist_id',
        manifestDistId: 'mock_manifest_dist_id',
        tarDistId: 'mock_tar_dist_id',
        readmeDistId: 'mock_readme_dist_id',
        publishTime: new Date(),
      });
      await packageVersionRepository.fixPaddingVersion('mock_package_17.0.18', new PaddingSemVer('17.0.18'));

      // 17.0.9
      await CnpmPackageVersionModel.create({
        packageId: 'mock_package_id',
        packageVersionId: 'mock_package_17.0.9',
        version: '17.0.9',
        abbreviatedDistId: 'mock_abbreviated_dist_id',
        manifestDistId: 'mock_manifest_dist_id',
        tarDistId: 'mock_tar_dist_id',
        readmeDistId: 'mock_readme_dist_id',
        publishTime: new Date(),
      });
      await packageVersionRepository.fixPaddingVersion('mock_package_17.0.9', new PaddingSemVer('17.0.9'));
      const version = await packageVersionService.getVersion(npa('mock_package@<18.0.0'));
      assert(version, '17.0.18');
    });

    describe('block-aware range resolution', () => {
      beforeEach(async () => {
        // 1.0.0 is created in the outer beforeEach with paddingVersion = null;
        // recompute it so it participates in the SqlRange query.
        await packageVersionRepository.fixPaddingVersion('mock_package_1.0.0', new PaddingSemVer('1.0.0'));
        await CnpmPackageVersionModel.create({
          packageId: 'mock_package_id',
          packageVersionId: 'mock_package_1.1.0',
          version: '1.1.0',
          abbreviatedDistId: 'mock_abbreviated_dist_id',
          manifestDistId: 'mock_manifest_dist_id',
          tarDistId: 'mock_tar_dist_id',
          readmeDistId: 'mock_readme_dist_id',
          publishTime: new Date(),
        });
        await packageVersionRepository.fixPaddingVersion('mock_package_1.1.0', new PaddingSemVer('1.1.0'));
        await CnpmPackageVersionModel.create({
          packageId: 'mock_package_id',
          packageVersionId: 'mock_package_1.2.0',
          version: '1.2.0',
          abbreviatedDistId: 'mock_abbreviated_dist_id',
          manifestDistId: 'mock_manifest_dist_id',
          tarDistId: 'mock_tar_dist_id',
          readmeDistId: 'mock_readme_dist_id',
          publishTime: new Date(),
        });
        await packageVersionRepository.fixPaddingVersion('mock_package_1.2.0', new PaddingSemVer('1.2.0'));
      });

      it('should skip a buffered version and fall back to the next satisfying one', async () => {
        await PackageVersionBlockModel.create({
          packageId: 'mock_package_id',
          packageVersionBlockId: 'block_buffer_1.2.0',
          version: '1.2.0',
          reason: '[buffer] isolation',
          type: 'buffer',
          expiredAt: new Date(Date.now() + 6 * 3600 * 1000),
        });
        const version = await packageVersionService.getVersion(npa('mock_package@^1.0.0'));
        assert.equal(version, '1.1.0');
      });

      it('should still skip an expired buffer version until the release worker removes it', async () => {
        // Manifest refresh filters by block existence, not expiredAt (PackageManagerService
        // uses listBlockedVersions). So while a buffer row lingers past expiry — before the
        // release worker deletes it — the version stays hidden from the manifest. Range
        // resolution must agree and keep skipping it, otherwise it would resolve to a version
        // the client cannot see yet.
        await PackageVersionBlockModel.create({
          packageId: 'mock_package_id',
          packageVersionBlockId: 'block_buf_exp_1.2.0',
          version: '1.2.0',
          reason: '[buffer] isolation',
          type: 'buffer',
          expiredAt: new Date(Date.now() - 1000),
        });
        const version = await packageVersionService.getVersion(npa('mock_package@^1.0.0'));
        assert.equal(version, '1.1.0');
      });

      it('should skip a permanently-blocked version and fall back to the next satisfying one', async () => {
        await PackageVersionBlockModel.create({
          packageId: 'mock_package_id',
          packageVersionBlockId: 'block_perm_1.2.0',
          version: '1.2.0',
          reason: 'security takedown',
          type: null,
          expiredAt: null,
        });
        const version = await packageVersionService.getVersion(npa('mock_package@^1.0.0'));
        assert.equal(version, '1.1.0');
      });

      it('should return falsy when every satisfying version is blocked', async () => {
        await PackageVersionBlockModel.create({
          packageId: 'mock_package_id',
          packageVersionBlockId: 'block_1.0.0',
          version: '1.0.0',
          reason: 'blocked',
          type: null,
          expiredAt: null,
        });
        await PackageVersionBlockModel.create({
          packageId: 'mock_package_id',
          packageVersionBlockId: 'block_1.1.0',
          version: '1.1.0',
          reason: 'blocked',
          type: null,
          expiredAt: null,
        });
        await PackageVersionBlockModel.create({
          packageId: 'mock_package_id',
          packageVersionBlockId: 'block_1.2.0',
          version: '1.2.0',
          reason: 'blocked',
          type: null,
          expiredAt: null,
        });
        const version = await packageVersionService.getVersion(npa('mock_package@^1.0.0'));
        assert(!version);
      });

      it('should skip blocked versions when range hits the prerelease branch', async () => {
        await CnpmPackageVersionModel.create({
          packageId: 'mock_package_id',
          packageVersionId: 'm_pkg_1.3.0-beta.1',
          version: '1.3.0-beta.1',
          abbreviatedDistId: 'mock_abbreviated_dist_id',
          manifestDistId: 'mock_manifest_dist_id',
          tarDistId: 'mock_tar_dist_id',
          readmeDistId: 'mock_readme_dist_id',
          publishTime: new Date(),
        });
        await packageVersionRepository.fixPaddingVersion('m_pkg_1.3.0-beta.1', new PaddingSemVer('1.3.0-beta.1'));
        await PackageVersionBlockModel.create({
          packageId: 'mock_package_id',
          packageVersionBlockId: 'block_buf_1.3.0b1',
          version: '1.3.0-beta.1',
          reason: '[buffer] isolation',
          type: 'buffer',
          expiredAt: new Date(Date.now() + 6 * 3600 * 1000),
        });
        // prerelease in the range triggers findSatisfyVersionsWithPrerelease
        const version = await packageVersionService.getVersion(npa('mock_package@>=1.2.0-0 <1.4.0'));
        assert.equal(version, '1.2.0');
      });

      it('should resolve range for an unknown package without blocked-version lookup', async () => {
        // findBlockedVersions short-circuits to [] when the package does not exist
        const version = await packageVersionService.getVersion(npa('not_exist_package@^1.0.0'));
        assert(!version);
      });
    });
  });
});
