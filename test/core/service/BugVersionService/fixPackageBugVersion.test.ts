import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';
import { BugVersionService } from '../../../../app/core/service/BugVersionService';
import { DistRepository } from '../../../../app/repository/DistRepository';
import { PackageRepository } from '../../../../app/repository/PackageRepository';
import { BugVersion } from '../../../../app/core/entity/BugVersion';
import { Package } from '../../../../app/core/entity/Package';
import { PackageVersion } from '../../../../app/core/entity/PackageVersion';
import { Dist } from '../../../../app/core/entity/Dist';

describe('test/core/service/BugVersionService/fixPackageBugVersion.test.ts', () => {
  let bugVersionService: BugVersionService;
  let bugVersion: BugVersion;
  let distRepository: DistRepository;
  let packageRepository: PackageRepository;

  beforeEach(async () => {
    bugVersionService = await app.getEggObject(BugVersionService);
    distRepository = await app.getEggObject(DistRepository);
    packageRepository = await app.getEggObject(PackageRepository);
    bugVersion = new BugVersion({
      faker: {
        '6.6.6': {
          version: '5.5.3',
          reason: 'Please use https://github.com/MilosPaunovic/community-faker instead',
        },
      },
      colors: {
        '1.4.44-liberty-2': {
          version: '1.4.0',
          reason: 'https://github.com/Marak/colors.js/issues/285',
        },
        '1.4.1': {
          version: '1.4.0',
          reason: 'https://github.com/Marak/colors.js/issues/285',
        },
        '1.4.2': {
          version: '1.4.0',
          reason: 'https://github.com/Marak/colors.js/issues/289',
        },
        '1.4.3': {
          version: '199.0.0',
          reason: 'https://github.com/Marak/colors.js/issues/289',
        },
      },
    });
    mock(distRepository, 'findPackageVersionManifest', async (_, version) => {
      if (version !== '199.0.0') {
        return {
          name: 'colors',
          version: '1.4.0',
          devDependencies: {
            eslint: '^5.2.0',
            'eslint-config-google': '^0.11.0',
          },
          dist: {
            integrity: 'sha512-a+UqTh4kgZg/SlGvfbzDHpgRu7AAQOmmqRHJnxhRZICKFUT91brVhNNt58CMWU9PsBbv3PDCZUHbVxuDiH2mtA==',
            shasum: 'c50491479d4c1bdaed2c9ced32cf7c7dc2360f78',
            tarball: 'https://registry.npmjs.org/colors/-/colors-1.4.0.tgz',
            fileCount: 21,
            unpackedSize: 39506,
            'npm-signature': '-----BEGIN PGP SIGNATURE-----\r\nVersion: OpenPGP.js v3.0.4\r\nComment: https://openpgpjs.org\r\n\r\nwsFcBAEBCAAQBQJdiAfACRA9TVsSAnZWagAA7gMP/1eUoL2YZSoe4XH3p7o5\n2NRhGJuE+81Kwbl/2+HWvlWGXxTo1vLYWGVAfBVYtEuUdnPlMOpCEyqdB8Ng\nqMr9acH/8ZkHKRyNYu9GeDLWWUFx8wv94qpcmnuqgp+24X3gBhiS7hnG6UJh\nL4kKUSycTGp0FFWPQ4tdpBuvC6PDGTowPfHh/oj0RosHygRcW6F4V5HDyws1\nQTnuE3k5vBhhzKQQ4oktGCUuQATqsg89lDDSw5hjThBf2y5ZrpF6qLVoiLgm\noMrEF3vDOIyf63naUmj/3qzBYFfQZU3wlGyaRfNxdqNooKW2QOb/x2XFtP46\nYibCl2xhGA0JsinmaAclbLfDkZSZs1bsjpj2xUOFJjQOeMReeS2PzCgHRBJy\nT9ow3X6MbRblOcWuX8Bbhr8kg9Av1xx2A9mtJ7G/DVuHLHBQOTro2l/qIb5M\nf9Z/++j4P1lMMKBp5jHvCRUNq9jgWdSaT9NHo1RvNKuEZM9mxyzyygcidj5w\ngaCGQ5G5kFOKAgmN1LvRYai5P31waqJ+Wr96g6XRfA9SBeeeX12v481jpKQm\nVZ6khQeII1VUgbadjWWegRAobEkW5JXLjdZbISZeIBahs5bOWPFiAFXowf4O\n7Hygdj0xtzkH/sWJeKUCxnzX6VN/mtu+QkPfjGBgDHNL4gtZsGDAizcsFuly\nDWUs\r\n=9VVk\r\n-----END PGP SIGNATURE-----\r\n',
          },
          engines: {
            node: '>=0.1.90',
          },
        };
      }
    });
    mock(packageRepository, 'findPackage', async () => {
      return new Package({
        updatedAt: new Date(),
        createdAt: new Date(),
        scope: '',
        name: 'colors',
        packageId: '0',
        isPrivate: false,
        description: '',
      });
    });
    mock(packageRepository, 'findPackageVersion', async () => {
      const dist = new Dist({
        updatedAt: new Date(),
        createdAt: new Date(),
        distId: '0',
        name: 'mock_dist',
        path: 'mock_dist',
        size: 0,
        shasum: 'mock_shasum',
        integrity: 'mock_integrity',
      });
      return new PackageVersion({
        updatedAt: new Date(),
        createdAt: new Date(),
        packageId: '0',
        packageVersionId: '0',
        version: '1.0.0',
        abbreviatedDist: dist,
        manifestDist: dist,
        tarDist: dist,
        readmeDist: dist,
        publishTime: new Date(),
        paddingVersion: null,
        isPreRelease: null,
      });
    });
  });

  afterEach(async () => {
    mock.restore();
    await TestUtil.truncateDatabase();
  });

  it('should fix all bug versions with advice', async () => {
    const manifest = {
      name: 'colors',
      version: '1.4.2',
      devDependencies: {
        eslint: '^5.2.0',
        'eslint-config-google': '^0.11.0',
      },
      dist: {
        integrity: 'sha512-a+UqTh4kgZg/SlGvfbzDHpgRu7AAQOmmqRHJnxhRZICKFUT91brVhNNt58CMWU9PsBbv3PDCZUHbVxuDiH2mtA==-bug-version',
        shasum: 'c50491479d4c1bdaed2c9ced32cf7c7dc2360f78-bug-version',
        tarball: 'https://registry.npmjs.org/colors/-/colors-1.4.2.tgz',
        fileCount: 21,
        unpackedSize: 39506,
        'npm-signature': '-----BEGIN PGP SIGNATURE-----\r\nVersion: OpenPGP.js v3.0.4\r\nComment: https://openpgpjs.org\r\n\r\nwsFcBAEBCAAQBQJdiAfACRA9TVsSAnZWagAA7gMP/1eUoL2YZSoe4XH3p7o5\n2NRhGJuE+81Kwbl/2+HWvlWGXxTo1vLYWGVAfBVYtEuUdnPlMOpCEyqdB8Ng\nqMr9acH/8ZkHKRyNYu9GeDLWWUFx8wv94qpcmnuqgp+24X3gBhiS7hnG6UJh\nL4kKUSycTGp0FFWPQ4tdpBuvC6PDGTowPfHh/oj0RosHygRcW6F4V5HDyws1\nQTnuE3k5vBhhzKQQ4oktGCUuQATqsg89lDDSw5hjThBf2y5ZrpF6qLVoiLgm\noMrEF3vDOIyf63naUmj/3qzBYFfQZU3wlGyaRfNxdqNooKW2QOb/x2XFtP46\nYibCl2xhGA0JsinmaAclbLfDkZSZs1bsjpj2xUOFJjQOeMReeS2PzCgHRBJy\nT9ow3X6MbRblOcWuX8Bbhr8kg9Av1xx2A9mtJ7G/DVuHLHBQOTro2l/qIb5M\nf9Z/++j4P1lMMKBp5jHvCRUNq9jgWdSaT9NHo1RvNKuEZM9mxyzyygcidj5w\ngaCGQ5G5kFOKAgmN1LvRYai5P31waqJ+Wr96g6XRfA9SBeeeX12v481jpKQm\nVZ6khQeII1VUgbadjWWegRAobEkW5JXLjdZbISZeIBahs5bOWPFiAFXowf4O\n7Hygdj0xtzkH/sWJeKUCxnzX6VN/mtu+QkPfjGBgDHNL4gtZsGDAizcsFuly\nDWUs\r\n=9VVk\r\n-----END PGP SIGNATURE-----\r\n',
      },
      engines: {
        node: '>=0.1.90',
      },
    };
    const newManifest = await bugVersionService.fixPackageBugVersion(bugVersion, 'colors', manifest);
    assert.deepStrictEqual(newManifest, {
      name: 'colors',
      version: '1.4.2',
      deprecated: '[WARNING] Use 1.4.0 instead of 1.4.2, reason: https://github.com/Marak/colors.js/issues/289',
      devDependencies: {
        eslint: '^5.2.0',
        'eslint-config-google': '^0.11.0',
      },
      dist: {
        integrity: 'sha512-a+UqTh4kgZg/SlGvfbzDHpgRu7AAQOmmqRHJnxhRZICKFUT91brVhNNt58CMWU9PsBbv3PDCZUHbVxuDiH2mtA==',
        shasum: 'c50491479d4c1bdaed2c9ced32cf7c7dc2360f78',
        tarball: 'https://registry.npmjs.org/colors/-/colors-1.4.0.tgz',
        fileCount: 21,
        unpackedSize: 39506,
        'npm-signature': '-----BEGIN PGP SIGNATURE-----\r\nVersion: OpenPGP.js v3.0.4\r\nComment: https://openpgpjs.org\r\n\r\nwsFcBAEBCAAQBQJdiAfACRA9TVsSAnZWagAA7gMP/1eUoL2YZSoe4XH3p7o5\n2NRhGJuE+81Kwbl/2+HWvlWGXxTo1vLYWGVAfBVYtEuUdnPlMOpCEyqdB8Ng\nqMr9acH/8ZkHKRyNYu9GeDLWWUFx8wv94qpcmnuqgp+24X3gBhiS7hnG6UJh\nL4kKUSycTGp0FFWPQ4tdpBuvC6PDGTowPfHh/oj0RosHygRcW6F4V5HDyws1\nQTnuE3k5vBhhzKQQ4oktGCUuQATqsg89lDDSw5hjThBf2y5ZrpF6qLVoiLgm\noMrEF3vDOIyf63naUmj/3qzBYFfQZU3wlGyaRfNxdqNooKW2QOb/x2XFtP46\nYibCl2xhGA0JsinmaAclbLfDkZSZs1bsjpj2xUOFJjQOeMReeS2PzCgHRBJy\nT9ow3X6MbRblOcWuX8Bbhr8kg9Av1xx2A9mtJ7G/DVuHLHBQOTro2l/qIb5M\nf9Z/++j4P1lMMKBp5jHvCRUNq9jgWdSaT9NHo1RvNKuEZM9mxyzyygcidj5w\ngaCGQ5G5kFOKAgmN1LvRYai5P31waqJ+Wr96g6XRfA9SBeeeX12v481jpKQm\nVZ6khQeII1VUgbadjWWegRAobEkW5JXLjdZbISZeIBahs5bOWPFiAFXowf4O\n7Hygdj0xtzkH/sWJeKUCxnzX6VN/mtu+QkPfjGBgDHNL4gtZsGDAizcsFuly\nDWUs\r\n=9VVk\r\n-----END PGP SIGNATURE-----\r\n',
      },
      engines: {
        node: '>=0.1.90',
      },
    });
  });

  it('should should not fix if not a bug version', async () => {
    const manifest = {
      name: 'colors',
      version: '99.4.2',
      devDependencies: {
        eslint: '^5.2.0',
        'eslint-config-google': '^0.11.0',
      },
      dist: {
        integrity: 'sha512-a+UqTh4kgZg/SlGvfbzDHpgRu7AAQOmmqRHJnxhRZICKFUT91brVhNNt58CMWU9PsBbv3PDCZUHbVxuDiH2mtA==-bug-version',
        shasum: 'c50491479d4c1bdaed2c9ced32cf7c7dc2360f78-bug-version',
        tarball: 'https://registry.npmjs.org/colors/-/colors-1.4.2.tgz',
        fileCount: 21,
        unpackedSize: 39506,
        'npm-signature': '-----BEGIN PGP SIGNATURE-----\r\nVersion: OpenPGP.js v3.0.4\r\nComment: https://openpgpjs.org\r\n\r\nwsFcBAEBCAAQBQJdiAfACRA9TVsSAnZWagAA7gMP/1eUoL2YZSoe4XH3p7o5\n2NRhGJuE+81Kwbl/2+HWvlWGXxTo1vLYWGVAfBVYtEuUdnPlMOpCEyqdB8Ng\nqMr9acH/8ZkHKRyNYu9GeDLWWUFx8wv94qpcmnuqgp+24X3gBhiS7hnG6UJh\nL4kKUSycTGp0FFWPQ4tdpBuvC6PDGTowPfHh/oj0RosHygRcW6F4V5HDyws1\nQTnuE3k5vBhhzKQQ4oktGCUuQATqsg89lDDSw5hjThBf2y5ZrpF6qLVoiLgm\noMrEF3vDOIyf63naUmj/3qzBYFfQZU3wlGyaRfNxdqNooKW2QOb/x2XFtP46\nYibCl2xhGA0JsinmaAclbLfDkZSZs1bsjpj2xUOFJjQOeMReeS2PzCgHRBJy\nT9ow3X6MbRblOcWuX8Bbhr8kg9Av1xx2A9mtJ7G/DVuHLHBQOTro2l/qIb5M\nf9Z/++j4P1lMMKBp5jHvCRUNq9jgWdSaT9NHo1RvNKuEZM9mxyzyygcidj5w\ngaCGQ5G5kFOKAgmN1LvRYai5P31waqJ+Wr96g6XRfA9SBeeeX12v481jpKQm\nVZ6khQeII1VUgbadjWWegRAobEkW5JXLjdZbISZeIBahs5bOWPFiAFXowf4O\n7Hygdj0xtzkH/sWJeKUCxnzX6VN/mtu+QkPfjGBgDHNL4gtZsGDAizcsFuly\nDWUs\r\n=9VVk\r\n-----END PGP SIGNATURE-----\r\n',
      },
      engines: {
        node: '>=0.1.90',
      },
    };
    const newManifest = await bugVersionService.fixPackageBugVersion(bugVersion, 'colors', manifest);
    assert(newManifest === manifest);
  });

  it('should should not fix if fixed version not exits', async () => {
    const manifest = {
      name: 'colors',
      version: '1.4.3',
      devDependencies: {
        eslint: '^5.2.0',
        'eslint-config-google': '^0.11.0',
      },
      dist: {
        integrity: 'sha512-a+UqTh4kgZg/SlGvfbzDHpgRu7AAQOmmqRHJnxhRZICKFUT91brVhNNt58CMWU9PsBbv3PDCZUHbVxuDiH2mtA==-bug-version',
        shasum: 'c50491479d4c1bdaed2c9ced32cf7c7dc2360f78-bug-version',
        tarball: 'https://registry.npmjs.org/colors/-/colors-1.4.2.tgz',
        fileCount: 21,
        unpackedSize: 39506,
        'npm-signature': '-----BEGIN PGP SIGNATURE-----\r\nVersion: OpenPGP.js v3.0.4\r\nComment: https://openpgpjs.org\r\n\r\nwsFcBAEBCAAQBQJdiAfACRA9TVsSAnZWagAA7gMP/1eUoL2YZSoe4XH3p7o5\n2NRhGJuE+81Kwbl/2+HWvlWGXxTo1vLYWGVAfBVYtEuUdnPlMOpCEyqdB8Ng\nqMr9acH/8ZkHKRyNYu9GeDLWWUFx8wv94qpcmnuqgp+24X3gBhiS7hnG6UJh\nL4kKUSycTGp0FFWPQ4tdpBuvC6PDGTowPfHh/oj0RosHygRcW6F4V5HDyws1\nQTnuE3k5vBhhzKQQ4oktGCUuQATqsg89lDDSw5hjThBf2y5ZrpF6qLVoiLgm\noMrEF3vDOIyf63naUmj/3qzBYFfQZU3wlGyaRfNxdqNooKW2QOb/x2XFtP46\nYibCl2xhGA0JsinmaAclbLfDkZSZs1bsjpj2xUOFJjQOeMReeS2PzCgHRBJy\nT9ow3X6MbRblOcWuX8Bbhr8kg9Av1xx2A9mtJ7G/DVuHLHBQOTro2l/qIb5M\nf9Z/++j4P1lMMKBp5jHvCRUNq9jgWdSaT9NHo1RvNKuEZM9mxyzyygcidj5w\ngaCGQ5G5kFOKAgmN1LvRYai5P31waqJ+Wr96g6XRfA9SBeeeX12v481jpKQm\nVZ6khQeII1VUgbadjWWegRAobEkW5JXLjdZbISZeIBahs5bOWPFiAFXowf4O\n7Hygdj0xtzkH/sWJeKUCxnzX6VN/mtu+QkPfjGBgDHNL4gtZsGDAizcsFuly\nDWUs\r\n=9VVk\r\n-----END PGP SIGNATURE-----\r\n',
      },
      engines: {
        node: '>=0.1.90',
      },
    };
    const newManifest = await bugVersionService.fixPackageBugVersion(bugVersion, 'colors', manifest);
    assert(newManifest === manifest);
  });
});
