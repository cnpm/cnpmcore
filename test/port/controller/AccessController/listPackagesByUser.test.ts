import assert from 'assert';
import { app } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';

describe('test/port/controller/AccessController/listPackagesByUser.test.ts', () => {
  describe('[GET /-/org/:username/package] listPackagesByUser()', () => {

    it('should work', async () => {
      const { pkg } = await TestUtil.createPackage({ version: '1.0.0' }, { name: 'banana' });
      const res = await app.httpRequest()
        .get('/-/org/banana/package')
        .expect(200);

      assert.equal(res.body[pkg.name], 'write');
    });

    it('should 404 when user not exists', async () => {
      const res = await app.httpRequest()
        .get('/-/org/banana-disappear/package')
        .expect(404);
      assert.equal(res.body.error, '[NOT_FOUND] User "banana-disappear" not found');
    });

  });
});
