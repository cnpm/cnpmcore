import { once } from 'node:events';
import type { Server, AddressInfo } from 'node:net';
import path from 'node:path';

import { app } from '@eggjs/mock/bootstrap';
import coffee from 'coffee';
import semver from 'semver';

import { TestUtil } from '../../../test/TestUtil.ts';
import { npmLogin } from '../CliUtil.ts';

describe('test/cli/npm/access.test.ts', () => {
  let server: Server;
  let registry: string;
  let fooPkgDir: string;
  let demoDir: string;
  let userconfig: string;
  let cacheDir: string;
  let useLegacyCommands: boolean;
  before(async () => {
    demoDir = await TestUtil.copyFixtures('demo');
    cacheDir = path.join(path.dirname(demoDir), 'cache');
    userconfig = path.join(path.dirname(demoDir), '.npmrc');
    fooPkgDir = TestUtil.getFixtures('@cnpm/foo');
    const npmVersion = await TestUtil.getNpmVersion();
    useLegacyCommands = semver.lt(String(npmVersion), '9.0.0');
    server = app.listen(0);
    await once(server, 'listening');
    registry = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    server.close();
    await TestUtil.cleanupFixtures();
  });

  beforeEach(async () => {
    await npmLogin(registry, userconfig);
    await coffee
      .spawn('npm', ['publish', `--registry=${registry}`, `--userconfig=${userconfig}`, `--cache=${cacheDir}`], {
        cwd: fooPkgDir,
      })
      .debug()
      .expect('code', 0)
      .end();
  });

  describe('npm access', () => {
    it('should work for list collaborators', async () => {
      const subCommands = useLegacyCommands ? ['ls-collaborators'] : ['list', 'collaborators'];
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
          },
        )
        .debug()
        .expect('stdout', /testuser:\sread-write|"testuser":\s"read-write"/)
        .expect('code', 0)
        .end();
    });

    it('should work for list all packages', async () => {
      const subCommands = useLegacyCommands ? ['ls-packages'] : ['list', 'packages'];
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
          },
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
        console.warn('npm list packages user package not implement lt 9.0.0, just skip');
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
          },
        )
        .debug()
        .expect('stdout', /@cnpm\/foo: read-write/)
        .expect('code', 0)
        .end();
    });
  });
});
