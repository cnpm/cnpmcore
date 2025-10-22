import assert from 'node:assert/strict';

import { BugVersion } from '../../../app/core/entity/BugVersion.ts';

describe('test/core/entity/BugVersion.test.ts', () => {
  const bugVersion = new BugVersion({
    faker: {
      '6.6.6': {
        version: '5.5.3',
        reason:
          'Please use https://github.com/MilosPaunovic/community-faker instead',
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
    },
  });

  describe('listAllPackagesHasBugs', () => {
    it('should work', () => {
      const pkgs = bugVersion.listAllPackagesHasBugs();
      assert.deepStrictEqual(pkgs, ['faker', 'colors']);
    });
  });

  describe('listBugVersions', () => {
    it('should work', () => {
      const bugVersions = bugVersion.listBugVersions('colors');
      assert.deepStrictEqual(bugVersions, [
        '1.4.44-liberty-2',
        '1.4.1',
        '1.4.2',
      ]);
    });

    it('should return [] if no bug version exits', () => {
      const bugVersions = bugVersion.listBugVersions('colors-not-bug');
      assert.deepStrictEqual(bugVersions, []);
    });
  });

  describe('fixVersion', () => {
    it('should return advice if hit bug version', () => {
      const advice = bugVersion.fixVersion('colors', '1.4.1');
      assert.deepStrictEqual(advice, {
        version: '1.4.0',
        reason: 'https://github.com/Marak/colors.js/issues/285',
      });
    });

    it('should return undefined if not a bug version', () => {
      const advice = bugVersion.fixVersion('colors', '1.4.3');
      assert.ok(!advice);
    });
  });

  describe('fixManifest', () => {
    it('should work', () => {
      const fixedManifest = bugVersion.fixManifest(
        {
          name: 'colors',
          version: '1.4.2',
          devDependencies: {
            eslint: '^5.2.0',
            'eslint-config-google': '^0.11.0',
          },
          dist: {
            integrity:
              'sha512-a+UqTh4kgZg/SlGvfbzDHpgRu7AAQOmmqRHJnxhRZICKFUT91brVhNNt58CMWU9PsBbv3PDCZUHbVxuDiH2mtA==-bug-version',
            shasum: 'c50491479d4c1bdaed2c9ced32cf7c7dc2360f78-bug-version',
            tarball: 'https://registry.npmjs.org/colors/-/colors-1.4.2.tgz',
            fileCount: 21,
            unpackedSize: 39_506,
            'npm-signature':
              '-----BEGIN PGP SIGNATURE-----\r\nVersion: OpenPGP.js v3.0.4\r\nComment: https://openpgpjs.org\r\n\r\nwsFcBAEBCAAQBQJdiAfACRA9TVsSAnZWagAA7gMP/1eUoL2YZSoe4XH3p7o5\n2NRhGJuE+81Kwbl/2+HWvlWGXxTo1vLYWGVAfBVYtEuUdnPlMOpCEyqdB8Ng\nqMr9acH/8ZkHKRyNYu9GeDLWWUFx8wv94qpcmnuqgp+24X3gBhiS7hnG6UJh\nL4kKUSycTGp0FFWPQ4tdpBuvC6PDGTowPfHh/oj0RosHygRcW6F4V5HDyws1\nQTnuE3k5vBhhzKQQ4oktGCUuQATqsg89lDDSw5hjThBf2y5ZrpF6qLVoiLgm\noMrEF3vDOIyf63naUmj/3qzBYFfQZU3wlGyaRfNxdqNooKW2QOb/x2XFtP46\nYibCl2xhGA0JsinmaAclbLfDkZSZs1bsjpj2xUOFJjQOeMReeS2PzCgHRBJy\nT9ow3X6MbRblOcWuX8Bbhr8kg9Av1xx2A9mtJ7G/DVuHLHBQOTro2l/qIb5M\nf9Z/++j4P1lMMKBp5jHvCRUNq9jgWdSaT9NHo1RvNKuEZM9mxyzyygcidj5w\ngaCGQ5G5kFOKAgmN1LvRYai5P31waqJ+Wr96g6XRfA9SBeeeX12v481jpKQm\nVZ6khQeII1VUgbadjWWegRAobEkW5JXLjdZbISZeIBahs5bOWPFiAFXowf4O\n7Hygdj0xtzkH/sWJeKUCxnzX6VN/mtu+QkPfjGBgDHNL4gtZsGDAizcsFuly\nDWUs\r\n=9VVk\r\n-----END PGP SIGNATURE-----\r\n',
          },
          engines: {
            node: '>=0.1.90',
          },
        },
        {
          name: 'colors',
          version: '1.4.0',
          devDependencies: {
            eslint: '^5.2.0',
            'eslint-config-google': '^0.11.0',
          },
          dist: {
            integrity:
              'sha512-a+UqTh4kgZg/SlGvfbzDHpgRu7AAQOmmqRHJnxhRZICKFUT91brVhNNt58CMWU9PsBbv3PDCZUHbVxuDiH2mtA==',
            shasum: 'c50491479d4c1bdaed2c9ced32cf7c7dc2360f78',
            tarball: 'https://registry.npmjs.org/colors/-/colors-1.4.0.tgz',
            fileCount: 21,
            unpackedSize: 39_506,
            'npm-signature':
              '-----BEGIN PGP SIGNATURE-----\r\nVersion: OpenPGP.js v3.0.4\r\nComment: https://openpgpjs.org\r\n\r\nwsFcBAEBCAAQBQJdiAfACRA9TVsSAnZWagAA7gMP/1eUoL2YZSoe4XH3p7o5\n2NRhGJuE+81Kwbl/2+HWvlWGXxTo1vLYWGVAfBVYtEuUdnPlMOpCEyqdB8Ng\nqMr9acH/8ZkHKRyNYu9GeDLWWUFx8wv94qpcmnuqgp+24X3gBhiS7hnG6UJh\nL4kKUSycTGp0FFWPQ4tdpBuvC6PDGTowPfHh/oj0RosHygRcW6F4V5HDyws1\nQTnuE3k5vBhhzKQQ4oktGCUuQATqsg89lDDSw5hjThBf2y5ZrpF6qLVoiLgm\noMrEF3vDOIyf63naUmj/3qzBYFfQZU3wlGyaRfNxdqNooKW2QOb/x2XFtP46\nYibCl2xhGA0JsinmaAclbLfDkZSZs1bsjpj2xUOFJjQOeMReeS2PzCgHRBJy\nT9ow3X6MbRblOcWuX8Bbhr8kg9Av1xx2A9mtJ7G/DVuHLHBQOTro2l/qIb5M\nf9Z/++j4P1lMMKBp5jHvCRUNq9jgWdSaT9NHo1RvNKuEZM9mxyzyygcidj5w\ngaCGQ5G5kFOKAgmN1LvRYai5P31waqJ+Wr96g6XRfA9SBeeeX12v481jpKQm\nVZ6khQeII1VUgbadjWWegRAobEkW5JXLjdZbISZeIBahs5bOWPFiAFXowf4O\n7Hygdj0xtzkH/sWJeKUCxnzX6VN/mtu+QkPfjGBgDHNL4gtZsGDAizcsFuly\nDWUs\r\n=9VVk\r\n-----END PGP SIGNATURE-----\r\n',
          },
          engines: {
            node: '>=0.1.90',
          },
        }
      );
      assert.deepStrictEqual(fixedManifest, {
        name: 'colors',
        version: '1.4.2',
        deprecated:
          '[WARNING] Use 1.4.0 instead of 1.4.2, reason: https://github.com/Marak/colors.js/issues/289',
        devDependencies: {
          eslint: '^5.2.0',
          'eslint-config-google': '^0.11.0',
        },
        dist: {
          integrity:
            'sha512-a+UqTh4kgZg/SlGvfbzDHpgRu7AAQOmmqRHJnxhRZICKFUT91brVhNNt58CMWU9PsBbv3PDCZUHbVxuDiH2mtA==',
          shasum: 'c50491479d4c1bdaed2c9ced32cf7c7dc2360f78',
          tarball: 'https://registry.npmjs.org/colors/-/colors-1.4.0.tgz',
          fileCount: 21,
          unpackedSize: 39_506,
          'npm-signature':
            '-----BEGIN PGP SIGNATURE-----\r\nVersion: OpenPGP.js v3.0.4\r\nComment: https://openpgpjs.org\r\n\r\nwsFcBAEBCAAQBQJdiAfACRA9TVsSAnZWagAA7gMP/1eUoL2YZSoe4XH3p7o5\n2NRhGJuE+81Kwbl/2+HWvlWGXxTo1vLYWGVAfBVYtEuUdnPlMOpCEyqdB8Ng\nqMr9acH/8ZkHKRyNYu9GeDLWWUFx8wv94qpcmnuqgp+24X3gBhiS7hnG6UJh\nL4kKUSycTGp0FFWPQ4tdpBuvC6PDGTowPfHh/oj0RosHygRcW6F4V5HDyws1\nQTnuE3k5vBhhzKQQ4oktGCUuQATqsg89lDDSw5hjThBf2y5ZrpF6qLVoiLgm\noMrEF3vDOIyf63naUmj/3qzBYFfQZU3wlGyaRfNxdqNooKW2QOb/x2XFtP46\nYibCl2xhGA0JsinmaAclbLfDkZSZs1bsjpj2xUOFJjQOeMReeS2PzCgHRBJy\nT9ow3X6MbRblOcWuX8Bbhr8kg9Av1xx2A9mtJ7G/DVuHLHBQOTro2l/qIb5M\nf9Z/++j4P1lMMKBp5jHvCRUNq9jgWdSaT9NHo1RvNKuEZM9mxyzyygcidj5w\ngaCGQ5G5kFOKAgmN1LvRYai5P31waqJ+Wr96g6XRfA9SBeeeX12v481jpKQm\nVZ6khQeII1VUgbadjWWegRAobEkW5JXLjdZbISZeIBahs5bOWPFiAFXowf4O\n7Hygdj0xtzkH/sWJeKUCxnzX6VN/mtu+QkPfjGBgDHNL4gtZsGDAizcsFuly\nDWUs\r\n=9VVk\r\n-----END PGP SIGNATURE-----\r\n',
        },
        engines: {
          node: '>=0.1.90',
        },
      });
    });

    it('should not recreate new manifest if has been fixed', () => {
      const originManifest = {
        name: 'colors',
        version: '1.4.2',
        devDependencies: {
          eslint: '^5.2.0',
          'eslint-config-google': '^0.11.0',
        },
        dist: {
          integrity:
            'sha512-a+UqTh4kgZg/SlGvfbzDHpgRu7AAQOmmqRHJnxhRZICKFUT91brVhNNt58CMWU9PsBbv3PDCZUHbVxuDiH2mtA==',
          shasum: 'c50491479d4c1bdaed2c9ced32cf7c7dc2360f78',
          tarball: 'https://registry.npmjs.org/colors/-/colors-1.4.0.tgz',
          fileCount: 21,
          unpackedSize: 39_506,
          'npm-signature':
            '-----BEGIN PGP SIGNATURE-----\r\nVersion: OpenPGP.js v3.0.4\r\nComment: https://openpgpjs.org\r\n\r\nwsFcBAEBCAAQBQJdiAfACRA9TVsSAnZWagAA7gMP/1eUoL2YZSoe4XH3p7o5\n2NRhGJuE+81Kwbl/2+HWvlWGXxTo1vLYWGVAfBVYtEuUdnPlMOpCEyqdB8Ng\nqMr9acH/8ZkHKRyNYu9GeDLWWUFx8wv94qpcmnuqgp+24X3gBhiS7hnG6UJh\nL4kKUSycTGp0FFWPQ4tdpBuvC6PDGTowPfHh/oj0RosHygRcW6F4V5HDyws1\nQTnuE3k5vBhhzKQQ4oktGCUuQATqsg89lDDSw5hjThBf2y5ZrpF6qLVoiLgm\noMrEF3vDOIyf63naUmj/3qzBYFfQZU3wlGyaRfNxdqNooKW2QOb/x2XFtP46\nYibCl2xhGA0JsinmaAclbLfDkZSZs1bsjpj2xUOFJjQOeMReeS2PzCgHRBJy\nT9ow3X6MbRblOcWuX8Bbhr8kg9Av1xx2A9mtJ7G/DVuHLHBQOTro2l/qIb5M\nf9Z/++j4P1lMMKBp5jHvCRUNq9jgWdSaT9NHo1RvNKuEZM9mxyzyygcidj5w\ngaCGQ5G5kFOKAgmN1LvRYai5P31waqJ+Wr96g6XRfA9SBeeeX12v481jpKQm\nVZ6khQeII1VUgbadjWWegRAobEkW5JXLjdZbISZeIBahs5bOWPFiAFXowf4O\n7Hygdj0xtzkH/sWJeKUCxnzX6VN/mtu+QkPfjGBgDHNL4gtZsGDAizcsFuly\nDWUs\r\n=9VVk\r\n-----END PGP SIGNATURE-----\r\n',
        },
        engines: {
          node: '>=0.1.90',
        },
      };
      const fixedManifest = bugVersion.fixManifest(originManifest, {
        name: 'colors',
        version: '1.4.0',
        devDependencies: {
          eslint: '^5.2.0',
          'eslint-config-google': '^0.11.0',
        },
        dist: {
          integrity:
            'sha512-a+UqTh4kgZg/SlGvfbzDHpgRu7AAQOmmqRHJnxhRZICKFUT91brVhNNt58CMWU9PsBbv3PDCZUHbVxuDiH2mtA==',
          shasum: 'c50491479d4c1bdaed2c9ced32cf7c7dc2360f78',
          tarball: 'https://registry.npmjs.org/colors/-/colors-1.4.0.tgz',
          fileCount: 21,
          unpackedSize: 39_506,
          'npm-signature':
            '-----BEGIN PGP SIGNATURE-----\r\nVersion: OpenPGP.js v3.0.4\r\nComment: https://openpgpjs.org\r\n\r\nwsFcBAEBCAAQBQJdiAfACRA9TVsSAnZWagAA7gMP/1eUoL2YZSoe4XH3p7o5\n2NRhGJuE+81Kwbl/2+HWvlWGXxTo1vLYWGVAfBVYtEuUdnPlMOpCEyqdB8Ng\nqMr9acH/8ZkHKRyNYu9GeDLWWUFx8wv94qpcmnuqgp+24X3gBhiS7hnG6UJh\nL4kKUSycTGp0FFWPQ4tdpBuvC6PDGTowPfHh/oj0RosHygRcW6F4V5HDyws1\nQTnuE3k5vBhhzKQQ4oktGCUuQATqsg89lDDSw5hjThBf2y5ZrpF6qLVoiLgm\noMrEF3vDOIyf63naUmj/3qzBYFfQZU3wlGyaRfNxdqNooKW2QOb/x2XFtP46\nYibCl2xhGA0JsinmaAclbLfDkZSZs1bsjpj2xUOFJjQOeMReeS2PzCgHRBJy\nT9ow3X6MbRblOcWuX8Bbhr8kg9Av1xx2A9mtJ7G/DVuHLHBQOTro2l/qIb5M\nf9Z/++j4P1lMMKBp5jHvCRUNq9jgWdSaT9NHo1RvNKuEZM9mxyzyygcidj5w\ngaCGQ5G5kFOKAgmN1LvRYai5P31waqJ+Wr96g6XRfA9SBeeeX12v481jpKQm\nVZ6khQeII1VUgbadjWWegRAobEkW5JXLjdZbISZeIBahs5bOWPFiAFXowf4O\n7Hygdj0xtzkH/sWJeKUCxnzX6VN/mtu+QkPfjGBgDHNL4gtZsGDAizcsFuly\nDWUs\r\n=9VVk\r\n-----END PGP SIGNATURE-----\r\n',
        },
        engines: {
          node: '>=0.1.90',
        },
      });
      assert.ok(!fixedManifest);
    });

    it('should not mofidy manifest if not a bug version', () => {
      const originManifest = {
        name: 'colors',
        version: '99.4.2',
        devDependencies: {
          eslint: '^5.2.0',
          'eslint-config-google': '^0.11.0',
        },
        dist: {
          integrity:
            'sha512-a+UqTh4kgZg/SlGvfbzDHpgRu7AAQOmmqRHJnxhRZICKFUT91brVhNNt58CMWU9PsBbv3PDCZUHbVxuDiH2mtA==',
          shasum: 'c50491479d4c1bdaed2c9ced32cf7c7dc2360f78',
          tarball: 'https://registry.npmjs.org/colors/-/colors-1.4.0.tgz',
          fileCount: 21,
          unpackedSize: 39_506,
          'npm-signature':
            '-----BEGIN PGP SIGNATURE-----\r\nVersion: OpenPGP.js v3.0.4\r\nComment: https://openpgpjs.org\r\n\r\nwsFcBAEBCAAQBQJdiAfACRA9TVsSAnZWagAA7gMP/1eUoL2YZSoe4XH3p7o5\n2NRhGJuE+81Kwbl/2+HWvlWGXxTo1vLYWGVAfBVYtEuUdnPlMOpCEyqdB8Ng\nqMr9acH/8ZkHKRyNYu9GeDLWWUFx8wv94qpcmnuqgp+24X3gBhiS7hnG6UJh\nL4kKUSycTGp0FFWPQ4tdpBuvC6PDGTowPfHh/oj0RosHygRcW6F4V5HDyws1\nQTnuE3k5vBhhzKQQ4oktGCUuQATqsg89lDDSw5hjThBf2y5ZrpF6qLVoiLgm\noMrEF3vDOIyf63naUmj/3qzBYFfQZU3wlGyaRfNxdqNooKW2QOb/x2XFtP46\nYibCl2xhGA0JsinmaAclbLfDkZSZs1bsjpj2xUOFJjQOeMReeS2PzCgHRBJy\nT9ow3X6MbRblOcWuX8Bbhr8kg9Av1xx2A9mtJ7G/DVuHLHBQOTro2l/qIb5M\nf9Z/++j4P1lMMKBp5jHvCRUNq9jgWdSaT9NHo1RvNKuEZM9mxyzyygcidj5w\ngaCGQ5G5kFOKAgmN1LvRYai5P31waqJ+Wr96g6XRfA9SBeeeX12v481jpKQm\nVZ6khQeII1VUgbadjWWegRAobEkW5JXLjdZbISZeIBahs5bOWPFiAFXowf4O\n7Hygdj0xtzkH/sWJeKUCxnzX6VN/mtu+QkPfjGBgDHNL4gtZsGDAizcsFuly\nDWUs\r\n=9VVk\r\n-----END PGP SIGNATURE-----\r\n',
        },
        engines: {
          node: '>=0.1.90',
        },
      };
      const fixedManifest = bugVersion.fixManifest(originManifest, {
        name: 'colors',
        version: '1.4.0',
        devDependencies: {
          eslint: '^5.2.0',
          'eslint-config-google': '^0.11.0',
        },
        dist: {
          integrity:
            'sha512-a+UqTh4kgZg/SlGvfbzDHpgRu7AAQOmmqRHJnxhRZICKFUT91brVhNNt58CMWU9PsBbv3PDCZUHbVxuDiH2mtA==',
          shasum: 'c50491479d4c1bdaed2c9ced32cf7c7dc2360f78',
          tarball: 'https://registry.npmjs.org/colors/-/colors-1.4.0.tgz',
          fileCount: 21,
          unpackedSize: 39_506,
          'npm-signature':
            '-----BEGIN PGP SIGNATURE-----\r\nVersion: OpenPGP.js v3.0.4\r\nComment: https://openpgpjs.org\r\n\r\nwsFcBAEBCAAQBQJdiAfACRA9TVsSAnZWagAA7gMP/1eUoL2YZSoe4XH3p7o5\n2NRhGJuE+81Kwbl/2+HWvlWGXxTo1vLYWGVAfBVYtEuUdnPlMOpCEyqdB8Ng\nqMr9acH/8ZkHKRyNYu9GeDLWWUFx8wv94qpcmnuqgp+24X3gBhiS7hnG6UJh\nL4kKUSycTGp0FFWPQ4tdpBuvC6PDGTowPfHh/oj0RosHygRcW6F4V5HDyws1\nQTnuE3k5vBhhzKQQ4oktGCUuQATqsg89lDDSw5hjThBf2y5ZrpF6qLVoiLgm\noMrEF3vDOIyf63naUmj/3qzBYFfQZU3wlGyaRfNxdqNooKW2QOb/x2XFtP46\nYibCl2xhGA0JsinmaAclbLfDkZSZs1bsjpj2xUOFJjQOeMReeS2PzCgHRBJy\nT9ow3X6MbRblOcWuX8Bbhr8kg9Av1xx2A9mtJ7G/DVuHLHBQOTro2l/qIb5M\nf9Z/++j4P1lMMKBp5jHvCRUNq9jgWdSaT9NHo1RvNKuEZM9mxyzyygcidj5w\ngaCGQ5G5kFOKAgmN1LvRYai5P31waqJ+Wr96g6XRfA9SBeeeX12v481jpKQm\nVZ6khQeII1VUgbadjWWegRAobEkW5JXLjdZbISZeIBahs5bOWPFiAFXowf4O\n7Hygdj0xtzkH/sWJeKUCxnzX6VN/mtu+QkPfjGBgDHNL4gtZsGDAizcsFuly\nDWUs\r\n=9VVk\r\n-----END PGP SIGNATURE-----\r\n',
        },
        engines: {
          node: '>=0.1.90',
        },
      });
      assert.ok(!fixedManifest);
    });
  });
});
