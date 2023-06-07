import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import dayjs from '../../../../app/common/dayjs';
import { TestUtil } from '../../../../test/TestUtil';

const SavePackageVersionDownloadCounterPath = require.resolve('../../../../app/port/schedule/SavePackageVersionDownloadCounter');

describe('test/port/controller/DownloadController/showPackageDownloads.test.ts', () => {
  let publisher;
  beforeEach(async () => {
    publisher = await TestUtil.createUser();
  });

  describe('[GET /downloads/range/:range/:fullname] showPackageDownloads()', () => {
    it('should get package download infos', async () => {
      let pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '2.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
      const pkg2 = await TestUtil.getFullPackage({ name: 'foo', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg2.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg2)
        .expect(201);

      const pkg3 = await TestUtil.getFullPackage({
        name: '@malware-test-cloth-diner-bosks-zante/foo',
        version: '1.0.0',
      });
      await app.httpRequest()
        .put(`/${pkg3.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg3)
        .expect(201);
      if (app.config.nfs.client) {
        await app.httpRequest()
          .get(`/${pkg.name}/-/koa-1.0.0.tgz`)
          .expect(302);
        await app.httpRequest()
          .get(`/${pkg.name}/-/koa-1.0.0.tgz`)
          .expect(302);
        await app.httpRequest()
          .get(`/${pkg.name}/-/koa-1.0.0.tgz`)
          .expect(302);
        await app.httpRequest()
          .get(`/${pkg.name}/-/koa-2.0.0.tgz`)
          .expect(302);
        await app.httpRequest()
          .get(`/${pkg2.name}/-/foo-1.0.0.tgz`)
          .expect(302);
        await app.httpRequest()
          .get(`/${pkg3.name}/-/foo-1.0.0.tgz`)
          .expect(302);
      } else {
        await app.httpRequest()
          .get(`/${pkg.name}/-/koa-1.0.0.tgz`)
          .expect('content-type', 'application/octet-stream')
          .expect(200);
        await app.httpRequest()
          .get(`/${pkg.name}/-/koa-1.0.0.tgz`)
          .expect('content-type', 'application/octet-stream')
          .expect(200);
        await app.httpRequest()
          .get(`/${pkg.name}/-/koa-1.0.0.tgz`)
          .expect('content-type', 'application/octet-stream')
          .expect(200);
        await app.httpRequest()
          .get(`/${pkg.name}/-/koa-2.0.0.tgz`)
          .expect('content-type', 'application/octet-stream')
          .expect(200);
        await app.httpRequest()
          .get(`/${pkg2.name}/-/foo-1.0.0.tgz`)
          .expect('content-type', 'application/octet-stream')
          .expect(200);
        await app.httpRequest()
          .get(`/${pkg3.name}/-/foo-1.0.0.tgz`)
          .expect('content-type', 'application/octet-stream')
          .expect(200);
      }

      await app.runSchedule(SavePackageVersionDownloadCounterPath);

      const start = dayjs().subtract(100, 'days').format('YYYY-MM-DD');
      const end = dayjs().add(100, 'days').format('YYYY-MM-DD');
      let res = await app.httpRequest()
        .get(`/downloads/range/${start}:${end}/@cnpm/koa`)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      let data = res.body;
      // console.log(data);
      assert(data.downloads.length > 0);
      assert.equal(data.downloads[0].downloads, 4);
      assert.equal(data.versions['1.0.0'][0].downloads, 3);

      res = await app.httpRequest()
        .get(`/downloads/range/${start}:${end}/foo`)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      data = res.body;
      // console.log(data);
      assert(data.downloads.length > 0);
      assert(data.downloads[0].downloads === 1);
      assert(data.versions['1.0.0'][0].downloads === 1);

      // __total__
      res = await app.httpRequest()
        .get(`/downloads/total/${start}:${end}`)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      data = res.body;
      // console.log(data);
      assert(data.downloads.length > 0);
      assert.equal(data.downloads[0].downloads, 6);
      assert(!data.versions);

      // scope
      res = await app.httpRequest()
        .get(`/downloads/@cnpm/${start}:${end}`)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      data = res.body;
      // console.log(data);
      assert(data.downloads.length > 0);
      assert.equal(data.downloads[0].downloads, 4);
      assert(!data.versions);

      res = await app.httpRequest()
        .get(`/downloads/@malware-test-cloth-diner-bosks-zante/${start}:${end}`)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      data = res.body;
      // console.log(data);
      assert(data.downloads.length > 0);
      assert.equal(data.downloads[0].downloads, 1);
      assert(!data.versions);
    });

    it('should get package download infos auto handle start and end position', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);
      if (app.config.nfs.client) {
        await app.httpRequest()
          .get(`/${pkg.name}/-/koa-1.0.0.tgz`)
          .expect(302);
      } else {
        await app.httpRequest()
          .get(`/${pkg.name}/-/koa-1.0.0.tgz`)
          .expect('content-type', 'application/octet-stream')
          .expect(200);
      }

      await app.runSchedule(SavePackageVersionDownloadCounterPath);

      const start = dayjs().format('YYYY-MM-DD');
      const end = dayjs().add(100, 'days').format('YYYY-MM-DD');
      const res = await app.httpRequest()
        .get(`/downloads/range/${end}:${start}/@cnpm/koa`)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      const data = res.body;
      // console.log(data);
      assert(data.downloads.length > 0);
      assert(data.versions);
    });

    it('should get package download infos with empty data', async () => {
      const pkg = await TestUtil.getFullPackage({ name: '@cnpm/koa', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .send(pkg)
        .expect(201);

      await app.runSchedule(SavePackageVersionDownloadCounterPath);

      const start = dayjs().format('YYYY-MM-DD');
      const end = dayjs().format('YYYY-MM-DD');
      const res = await app.httpRequest()
        .get(`/downloads/range/${start}:${end}/@cnpm/koa`)
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      const data = res.body;
      assert.equal(data.downloads.length, 0);
    });

    it('should 404 when package not exists', async () => {
      const start = dayjs().format('YYYY-MM-DD');
      const end = dayjs().format('YYYY-MM-DD');
      const res = await app.httpRequest()
        .get(`/downloads/range/${start}:${end}/@cnpm/koa-not-exists`)
        .expect(404)
        .expect('content-type', 'application/json; charset=utf-8');
      const data = res.body;
      assert.equal(data.error, '[NOT_FOUND] @cnpm/koa-not-exists not found');
    });

    it('should 422 when out of range', async () => {
      const start = dayjs().format('YYYY-MM-DD');
      const end = dayjs().add(1, 'year').add(1, 'day')
        .format('YYYY-MM-DD');
      const res = await app.httpRequest()
        .get(`/downloads/range/${start}:${end}/@cnpm/koa`)
        .expect(422)
        .expect('content-type', 'application/json; charset=utf-8');
      const data = res.body;
      assert.match(data.error, /beyond the processable range/);
    });

    it('should 422 when out of range, switch start and end range', async () => {
      const start = dayjs().format('YYYY-MM-DD');
      const end = dayjs().add(1, 'year').add(10, 'day')
        .format('YYYY-MM-DD');
      const res = await app.httpRequest()
        .get(`/downloads/range/${end}:${start}/@cnpm/koa`)
        .expect(422)
        .expect('content-type', 'application/json; charset=utf-8');
      const data = res.body;
      assert.match(data.error, /beyond the processable range/);
    });

    it('should 422 when range format invalid', async () => {
      let res = await app.httpRequest()
        .get('/downloads/range/f:b/@cnpm/koa')
        .expect('content-type', 'application/json; charset=utf-8');
      let data = res.body;
      assert.equal(res.status, 422);
      assert.equal(data.error, '[UNPROCESSABLE_ENTITY] range(f:b) format invalid, must be "YYYY-MM-DD:YYYY-MM-DD" style');

      res = await app.httpRequest()
        .get('/downloads/range/2017-10-1:2017-09-10/@cnpm/koa')
        .expect('content-type', 'application/json; charset=utf-8');
      data = res.body;
      assert.equal(res.status, 422);
      assert.equal(data.error, '[UNPROCESSABLE_ENTITY] range(2017-10-1:2017-09-10) format invalid, must be "YYYY-MM-DD:YYYY-MM-DD" style');

      res = await app.httpRequest()
        .get('/downloads/range/2017-10-91:2017-09-10/@cnpm/koa')
        .expect('content-type', 'application/json; charset=utf-8');
      data = res.body;
      assert.equal(res.status, 422);
      assert.equal(data.error, '[UNPROCESSABLE_ENTITY] range(2017-10-91:2017-09-10) format invalid, must be "YYYY-MM-DD:YYYY-MM-DD" style');

      res = await app.httpRequest()
        .get('/downloads/range/2017-10-91:2017-00-10/@cnpm/koa')
        .expect('content-type', 'application/json; charset=utf-8');
      data = res.body;
      assert.equal(res.status, 422);
      assert.equal(data.error, '[UNPROCESSABLE_ENTITY] range(2017-10-91:2017-00-10) format invalid, must be "YYYY-MM-DD:YYYY-MM-DD" style');

      res = await app.httpRequest()
        .get('/downloads/range/2017-10-11:2017-09-99/@cnpm/koa')
        .expect('content-type', 'application/json; charset=utf-8');
      data = res.body;
      assert.equal(res.status, 422);
      assert.equal(data.error, '[UNPROCESSABLE_ENTITY] range(2017-10-11:2017-09-99) format invalid, must be "YYYY-MM-DD:YYYY-MM-DD" style');
    });
  });
});
