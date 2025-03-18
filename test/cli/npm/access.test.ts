import path from 'node:path';
import { once } from 'node:events';
import type { Server, AddressInfo } from 'node:net';

import { app } from '@eggjs/mock/bootstrap';
import coffee from 'coffee';
import semver from 'semver';

import { TestUtil } from '../../../test/TestUtil.js';
import { npmLogin } from '../CliUtil.js';

describe('test/cli/npm/access.test.ts', () => {
  let server: Server;
  let registry: string;
  let fooPkgDir: string;
  let demoDir: string;
  let userconfig: string;
  let cacheDir: string;
  let useLegacyCommands: boolean;
  before(async () => {
    cacheDir = TestUtil.mkdtemp();
    fooPkgDir = TestUtil.getFixtures('@cnpm/foo');
    demoDir = TestUtil.getFixtures('demo');
    userconfig = path.join(fooPkgDir, '.npmrc');
    await TestUtil.rm(userconfig);
    await TestUtil.rm(path.join(demoDir, 'node_modules'));
    const npmVersion = await TestUtil.getNpmVersion();
    useLegacyCommands = semver.lt(String(npmVersion), '9.0.0');
    server = app.listen(0);
    await once(server, 'listening');
    registry = `http://localhost:${(server.address() as AddressInfo).port}`;
    // console.log(`registry ${registry} ready`);
  });

  after(async () => {
    await TestUtil.rm(userconfig);
    await TestUtil.rm(cacheDir);
    await TestUtil.rm(path.join(demoDir, 'node_modules'));
    server.close();
  });

  beforeEach(async () => {
    await npmLogin(registry, userconfig);
    await coffee
      .spawn(
        'npm',
        [
          'publish',
          `--registry=${registry}`,
          `--userconfig=${userconfig}`,
          `--cache=${cacheDir}`,
        ],
        {
          cwd: fooPkgDir,
        }
      )
      .debug()
      .expect('code', 0)
      .end();
  });

  describe('npm access', () => {
    it('should work for list collaborators', async () => {
      const subCommands = useLegacyCommands
        ? ['ls-collaborators']
        : ['list', 'collaborators'];
      await coffee
        .spawn(
          'npm',
          [
            'access',
            ...subCommands,
            '@cnpm/foo',
            `--registry=${registry}`,
            `--userconfig=${userconfig}`,
            `--cache=${cacheDir}`,
            // '--json',
          ],
          {
            cwd: demoDir,
          }
        )
        .debug()
        .expect('stdout', /testuser:\sread-write|"testuser":\s"read-write"/)
        .expect('code', 0)
        .end();
    });

    it('should work for list all packages', async () => {
      const subCommands = useLegacyCommands
        ? ['ls-packages']
        : ['list', 'packages'];
      await coffee
        .spawn(
          'npm',
          [
            'access',
            ...subCommands,
            'testuser',
            `--registry=${registry}`,
            `--userconfig=${userconfig}`,
            `--cache=${cacheDir}`,
            // '--json',
          ],
          {
            cwd: demoDir,
          }
        )
        .debug()
        .expect('stdout', /@cnpm\/foo: read-write|"@cnpm\/foo":\s"read-write"/)
        .expect('code', 0)
        .end();
    });

    it('should work for list single package', async () => {
      // not support in npm7 * 8
      if (useLegacyCommands) {
        // oxlint-disable-next-line no-console
        console.warn(
          'npm list packages user package not implement lt 9.0.0, just skip'
        );
        return;
      }
      await coffee
        .spawn(
          'npm',
          [
            'access',
            'list',
            'packages',
            'testuser',
            '@cnpm/foo',
            `--registry=${registry}`,
            `--userconfig=${userconfig}`,
            `--cache=${cacheDir}`,
            // '--json',
          ],
          {
            cwd: demoDir,
          }
        )
        .debug()
        .expect('stdout', /@cnpm\/foo: read-write/)
        .expect('code', 0)
        .end();
    });
  });
});
