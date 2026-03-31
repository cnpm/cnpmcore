import { once } from 'node:events';
import type { AddressInfo, Server } from 'node:net';
import path from 'node:path';

import { app } from '@eggjs/mock/bootstrap';
import coffee from 'coffee';

import { TestUtil } from '../../../test/TestUtil.ts';
import { npmLogin } from '../CliUtil.ts';

describe('test/cli/npm/team.test.ts', () => {
  let server: Server;
  let registry: string;
  let fooPkgDir: string;
  let demoDir: string;
  let userconfig: string;
  let cacheDir: string;

  before(async () => {
    cacheDir = TestUtil.mkdtemp();
    fooPkgDir = TestUtil.getFixtures('@cnpm/foo');
    demoDir = TestUtil.getFixtures('demo');
    userconfig = path.join(fooPkgDir, '.npmrc');
    await TestUtil.rm(userconfig);
    server = app.listen(0);
    await once(server, 'listening');
    registry = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    await TestUtil.rm(userconfig);
    await TestUtil.rm(cacheDir);
    server?.close();
  });

  beforeEach(async () => {
    await npmLogin(registry, userconfig);
  });

  describe('npm team', () => {
    it('should create team', async () => {
      await coffee
        .spawn(
          'npm',
          [
            'team',
            'create',
            '@cnpm:test-cli-team',
            `--registry=${registry}`,
            `--userconfig=${userconfig}`,
            `--cache=${cacheDir}`,
          ],
          { cwd: demoDir },
        )
        .debug()
        .expect('code', 0)
        .end();
    });

    it('should list teams', async () => {
      // create first
      await coffee
        .spawn(
          'npm',
          [
            'team',
            'create',
            '@cnpm:ls-team',
            `--registry=${registry}`,
            `--userconfig=${userconfig}`,
            `--cache=${cacheDir}`,
          ],
          { cwd: demoDir },
        )
        .debug()
        .expect('code', 0)
        .end();

      await coffee
        .spawn(
          'npm',
          ['team', 'ls', '@cnpm', `--registry=${registry}`, `--userconfig=${userconfig}`, `--cache=${cacheDir}`],
          { cwd: demoDir },
        )
        .debug()
        .expect('stdout', /ls-team/)
        .expect('code', 0)
        .end();
    });

    it('should destroy team', async () => {
      await coffee
        .spawn(
          'npm',
          [
            'team',
            'create',
            '@cnpm:to-destroy',
            `--registry=${registry}`,
            `--userconfig=${userconfig}`,
            `--cache=${cacheDir}`,
          ],
          { cwd: demoDir },
        )
        .debug()
        .expect('code', 0)
        .end();

      await coffee
        .spawn(
          'npm',
          [
            'team',
            'destroy',
            '@cnpm:to-destroy',
            `--registry=${registry}`,
            `--userconfig=${userconfig}`,
            `--cache=${cacheDir}`,
          ],
          { cwd: demoDir },
        )
        .debug()
        .expect('code', 0)
        .end();
    });
  });

  describe('npm access grant/revoke', () => {
    beforeEach(async () => {
      // publish package first
      await coffee
        .spawn('npm', ['publish', `--registry=${registry}`, `--userconfig=${userconfig}`, `--cache=${cacheDir}`], {
          cwd: fooPkgDir,
        })
        .debug()
        .expect('code', 0)
        .end();

      // create team
      await coffee
        .spawn(
          'npm',
          [
            'team',
            'create',
            '@cnpm:access-team',
            `--registry=${registry}`,
            `--userconfig=${userconfig}`,
            `--cache=${cacheDir}`,
          ],
          { cwd: demoDir },
        )
        .debug()
        .end();
    });

    it('should grant and list package access', async () => {
      // grant
      await coffee
        .spawn(
          'npm',
          [
            'access',
            'grant',
            'read-only',
            '@cnpm:access-team',
            '@cnpm/foo',
            `--registry=${registry}`,
            `--userconfig=${userconfig}`,
            `--cache=${cacheDir}`,
          ],
          { cwd: demoDir },
        )
        .debug()
        .expect('code', 0)
        .end();

      // list packages
      await coffee
        .spawn(
          'npm',
          [
            'access',
            'list',
            'packages',
            '@cnpm:access-team',
            `--registry=${registry}`,
            `--userconfig=${userconfig}`,
            `--cache=${cacheDir}`,
          ],
          { cwd: demoDir },
        )
        .debug()
        .expect('stdout', /@cnpm\/foo/)
        .expect('code', 0)
        .end();
    });

    it('should revoke package access', async () => {
      // grant first
      await coffee
        .spawn(
          'npm',
          [
            'access',
            'grant',
            'read-only',
            '@cnpm:access-team',
            '@cnpm/foo',
            `--registry=${registry}`,
            `--userconfig=${userconfig}`,
            `--cache=${cacheDir}`,
          ],
          { cwd: demoDir },
        )
        .debug()
        .expect('code', 0)
        .end();

      // revoke
      await coffee
        .spawn(
          'npm',
          [
            'access',
            'revoke',
            '@cnpm:access-team',
            '@cnpm/foo',
            `--registry=${registry}`,
            `--userconfig=${userconfig}`,
            `--cache=${cacheDir}`,
          ],
          { cwd: demoDir },
        )
        .debug()
        .expect('code', 0)
        .end();
    });
  });
});
