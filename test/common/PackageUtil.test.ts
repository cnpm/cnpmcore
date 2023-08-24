import assert from 'assert';
import { formatAuthor, formatTarball, hasShrinkWrapInTgz } from '../../app/common/PackageUtil';
import { TestUtil } from '../TestUtil';

describe('test/common/PackageUtil.test.ts', () => {
  describe('formatTarball()', () => {
    it('should work', () => {
      assert.equal(formatTarball('https://r.cnpmjs.org', '', 'foo', '1.0.0'), 'https://r.cnpmjs.org/foo/-/foo-1.0.0.tgz');
      assert.equal(formatTarball('https://r.cnpmjs.org', '@bar', 'foo', '1.0.0'), 'https://r.cnpmjs.org/@bar/foo/-/foo-1.0.0.tgz');
    });
  });

  describe('hasShrinkWrapInTgz()', () => {
    it('should work', async () => {
      const tgzWithShrinkWrap = await TestUtil.readFixturesFile('shrinkwrap-test/shrinkwrap-test--has.tgz');
      assert.equal(await hasShrinkWrapInTgz(tgzWithShrinkWrap), true);

      const tgzWithoutShrinkWrap = await TestUtil.readFixturesFile('shrinkwrap-test/shrinkwrap-test--not-has.tgz');
      assert.equal(await hasShrinkWrapInTgz(tgzWithoutShrinkWrap), false);

      const brokenTgz = await TestUtil.readFixturesFile('shrinkwrap-test/shrinkwrap-test--broken.tgz');
      assert.equal(await hasShrinkWrapInTgz(brokenTgz), false);

      const bigTarballUrl = 'https://r.cnpmjs.org/monaco-editor/-/monaco-editor-0.37.1.tgz';
      const bigBufferResult = await TestUtil.app.httpclient.request(bigTarballUrl, { dataType: 'buffer' });
      assert.equal(bigBufferResult.data.length, /* ~16MB */ 16035586);
      assert.equal(await hasShrinkWrapInTgz(bigBufferResult.data), false);
    });
  });

  describe('formatAuthor()', () => {
    it('should work', () => {
      const mockedAuthor = { name: 'cnpmcore', email: 'cnpmcore@example.com' };
      assert.equal(formatAuthor(undefined), undefined);
      assert.deepEqual(formatAuthor(mockedAuthor.name), { name: mockedAuthor.name });
      assert.deepEqual(formatAuthor(mockedAuthor), mockedAuthor);
    });
  });
});
