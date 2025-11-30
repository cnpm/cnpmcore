import assert from 'node:assert/strict';

import { mimeLookup } from '../../app/common/FileUtil.ts';

describe('test/common/FileUtil.test.ts', () => {
  describe('mimeLookup()', () => {
    it('should work', () => {
      assert.equal(mimeLookup('/foo/README'), 'text/plain');
      assert.equal(mimeLookup('/License'), 'text/plain');
      assert.equal(mimeLookup('/HISTORY'), 'text/plain');
      assert.equal(mimeLookup('/foo/changelog'), 'text/plain');
      assert.equal(mimeLookup('/.npmignore'), 'text/plain');
      assert.equal(mimeLookup('/.jshintignore'), 'text/plain');
      assert.equal(mimeLookup('/.jshintrc'), 'application/json');
      assert.equal(mimeLookup('/.jshintignore'), 'text/plain');
      assert.equal(mimeLookup('/.eslintignore'), 'text/plain');
      assert.equal(mimeLookup('/.eslintrc'), 'application/json');
      assert.equal(mimeLookup('/docs/_plugins/markdown.rb'), 'application/octet-stream');
      assert.equal(mimeLookup('/docs/static/less/pouchdb/anchors.less'), 'text/less');
      assert.equal(mimeLookup('/docs/static/less/pouchdb/anchors.css'), 'text/css');
      assert.equal(mimeLookup('/foo/bar.xml'), 'text/plain');
      assert.equal(mimeLookup('/foo/bar.html'), 'text/plain');
      assert.equal(mimeLookup('/favicon.ico'), 'image/vnd.microsoft.icon');
      assert.equal(mimeLookup('/index.ts'), 'text/plain');
      assert.equal(mimeLookup('/index.d.ts'), 'text/plain');
      assert.equal(mimeLookup('/index.txt'), 'text/plain');
      assert.equal(mimeLookup('pkg-yarn.lock'), 'text/plain');
    });
  });
});
