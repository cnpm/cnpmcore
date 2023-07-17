import { app, assert } from 'egg-mock/bootstrap';

describe('test/port/controller/HomeController/misc.test.ts', () => {
  describe('[POST /*] misc()', () => {
    it('should 501', async () => {
      const res = await app.httpRequest()
        .post('/-/npm/v1/security/audits/quick')
        .expect(501);
      assert.equal(res.body.error, '[NOT_IMPLEMENTED] /-/npm/v1/security/audits/quick not implemented yet');
    });

    it('should 404', async () => {
      const res = await app.httpRequest()
        .post('/-/greed/is/good')
        .expect(404);
      assert.equal(res.body.error, '[NOT_FOUND] /-/greed/is/good not found');
    });
  });

});
