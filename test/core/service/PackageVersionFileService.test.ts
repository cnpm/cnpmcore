import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

import { app, mock } from '@eggjs/mock/bootstrap';
import * as tar from 'tar';

import { createTempDir } from '../../../app/common/FileUtil.ts';
import { calculateIntegrity, getScopeAndName } from '../../../app/common/PackageUtil.ts';
import { PackageVersionFileService } from '../../../app/core/service/PackageVersionFileService.ts';
import { PackageRepository } from '../../../app/repository/PackageRepository.ts';
import { TestUtil } from '../../../test/TestUtil.ts';

function createTarball(entries: Array<{ path: string; content: string }>) {
  const blocks: Buffer[] = [];
  for (const entry of entries) {
    const content = Buffer.from(entry.content);
    const headerBlock = Buffer.alloc(512);
    const header = new tar.Header({
      path: entry.path,
      mode: 0o644,
      size: content.length,
      mtime: new Date(0),
      type: 'File',
    });
    header.encode(headerBlock);
    assert.equal(header.needPax, false);
    blocks.push(headerBlock, content);
    const remainder = content.length % 512;
    if (remainder > 0) {
      blocks.push(Buffer.alloc(512 - remainder));
    }
  }
  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks));
}

describe('test/core/service/PackageVersionFileService.test.ts', () => {
  it('should only use regular files extracted inside the temporary directory', async () => {
    mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
    mock(app.config.cnpmcore, 'enableUnpkg', true);
    mock(app.config.cnpmcore, 'enableSyncUnpkgFiles', true);
    mock(PackageVersionFileService.prototype, 'checkPackageVersionInUnpkgWhiteList', async () => {});

    const referenceDir = await createTempDir(app.config.dataDir, `path_traversal_reference_${randomUUID()}`);
    const secretFile = join(app.config.dataDir, `path_traversal_secret_${randomUUID()}.txt`);
    const secret = `CNPMCORE_TEST_SECRET=${randomUUID()}`;
    await fs.writeFile(secretFile, secret);

    try {
      const traversal = relative(join(referenceDir, 'README.md'), secretFile).split(sep).join('/');
      assert.ok(traversal.startsWith('../'));
      const tarball = createTarball([
        {
          path: 'package/package.json',
          content: JSON.stringify({ name: 'path-traversal-package', version: '1.0.0' }),
        },
        {
          path: `package/README.md/${traversal}`,
          content: 'attacker-controlled archive content',
        },
      ]);
      const distIntegrity = await calculateIntegrity(tarball);
      const pkg = await TestUtil.getFullPackage({
        name: 'path-traversal-package',
        version: '1.0.0',
        attachment: {
          data: tarball.toString('base64'),
          length: tarball.length,
        },
        dist: distIntegrity,
      });
      const publisher = await TestUtil.createUser();
      await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);

      const packageRepository = await app.getEggObject(PackageRepository);
      const [scope, name] = getScopeAndName(pkg.name);
      const packageEntity = await packageRepository.findPackage(scope, name);
      assert.ok(packageEntity);
      const packageVersion = await packageRepository.findPackageVersion(packageEntity.packageId, '1.0.0');
      assert.ok(packageVersion);

      const service = await app.getEggObject(PackageVersionFileService);
      const originalVersionReadme = (await app.httpRequest().get(`/${pkg.name}/1.0.0`).expect(200)).body.readme;
      const originalPackageReadme = (await app.httpRequest().get(`/${pkg.name}`).expect(200)).body.readme;
      const files = await service.syncPackageVersionFiles(packageVersion);
      assert.deepEqual(
        files.map((file) => file.path),
        ['/package.json'],
      );

      await service.syncPackageReadme(packageEntity, packageVersion);
      const versionResponse = await app.httpRequest().get(`/${pkg.name}/1.0.0`).expect(200);
      assert.equal(versionResponse.body.readme, originalVersionReadme);
      const packageResponse = await app.httpRequest().get(`/${pkg.name}`).expect(200);
      assert.equal(packageResponse.body.readme, originalPackageReadme);
    } finally {
      await fs.rm(secretFile, { force: true });
      await fs.rm(referenceDir, { recursive: true, force: true });
    }
  });
});
