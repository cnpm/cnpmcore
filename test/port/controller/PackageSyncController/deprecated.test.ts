import assert = require('assert');
import { app } from 'egg-mock/bootstrap';

describe('test/port/controller/PackageSyncController/deprecated.test.ts', () => {
  describe('[GET /-/all/since] deprecatedListSince()', () => {
    it('should 200 and empty', async () => {
      const res = await app.httpRequest()
        .get('/-/all/since?stale=update_after&startkey=1');
      assert(res.status === 200);
      assert(Object.keys(res.body).length === 1);
      assert(res.body._updated);
    });
  });

  describe('[GET /-/short] deprecatedListShort()', () => {
    it('should 200 and empty', async () => {
      const res = await app.httpRequest()
        .get('/-/short');
      assert(res.status === 200);
      assert(res.body.length === 0);
    });
  });
});
