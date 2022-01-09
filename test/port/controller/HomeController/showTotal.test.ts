import assert = require('assert');
import { Context } from 'egg';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from 'test/TestUtil';
import { PackageVersionDownload } from 'app/repository/model/PackageVersionDownload';
import dayjs from 'app/common/dayjs';

describe('test/port/controller/HomeController/showTotal.test.ts', () => {
  let ctx: Context;
  beforeEach(async () => {
    ctx = await app.mockModuleContext();
  });

  afterEach(() => {
    app.destroyModuleContext(ctx);
  });

  describe('[GET /] showTotal()', () => {
    it('should total information', async () => {
      await TestUtil.truncateDatabase();
      let res = await app.httpRequest()
        .get('/');
      assert(res.status === 200);
      assert(res.headers['content-type'] === 'application/json; charset=utf-8');
      // ignore on oss, it was unstable
      // https://github.com/cnpm/cnpmcore/runs/4748567783?check_suite_focus=true#step:6:748
      if (process.env.CNPMCORE_NFS_TYPE === 'oss') return;

      let data = res.body;
      assert(data.doc_count === 0);
      assert(data.doc_version_count === 0);
      assert(data.download.today === 0);
      assert(data.engine === app.config.orm.client);
      assert(data.node_version === process.version);
      assert(data.instance_start_time);
      assert(data.sync_model === 'none');
      assert(data.sync_binary === false);

      // downloads count
      const publisher = await TestUtil.createUser();
      let pkg = await TestUtil.getFullPackage({ name: '@cnpm/home1', version: '1.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .expect(201)
        .send(pkg);
      pkg = await TestUtil.getFullPackage({ name: '@cnpm/home2', version: '2.0.0' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .expect(201)
        .send(pkg);
      pkg = await TestUtil.getFullPackage({ name: '@cnpm/home1', version: '1.0.1' });
      await app.httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .expect(201)
        .send(pkg);

      await app.httpRequest()
        .get('/@cnpm/home1/-/home1-1.0.0.tgz');
      await app.httpRequest()
        .get('/@cnpm/home1/-/home1-1.0.1.tgz');
      await app.httpRequest()
        .get('/@cnpm/home2/-/home2-2.0.0.tgz');
      await app.runSchedule('SavePackageVersionDownloadCounter');
      await app.runSchedule('UpdateTotalData');

      res = await app.httpRequest()
        .get('/');
      assert(res.status === 200);
      data = res.body;
      assert(data.last_pacakge === '@cnpm/home2');
      assert(data.last_pacakge_version === '@cnpm/home1@1.0.1');
      assert(data.doc_count === 2);
      assert(data.doc_version_count === 3);
      assert(data.download.today === 3);
      assert(data.download.yesterday === 0);
      assert(data.download.thisweek === 3);
      assert(data.download.thismonth === 3);
      assert(data.download.thisyear === 3);
      assert(data.download.lastweek === 0);
      assert(data.download.lastmonth === 0);
      assert(data.download.lastyear === 0);

      // mock yesterday lastweek lastmonth
      const today = dayjs();
      const yesterdayYearMonthInt = Number(today.subtract(1, 'day').format('YYYYMM'));
      const yesterdayDate = today.subtract(1, 'day').format('DD');
      const lastWeekYearMonthInt = Number(today.subtract(1, 'week').startOf('week').format('YYYYMM'));
      const lastWeekDate = today.subtract(1, 'week').startOf('week').format('DD');
      const lastMonthYearMonthInt = Number(today.subtract(1, 'month').startOf('month').format('YYYYMM'));
      const lastMonthDate = today.subtract(1, 'month').startOf('month').format('DD');
      const lastYearYearMonthInt = Number(today.subtract(1, 'year').startOf('year').format('YYYYMM'));
      const lastYearDate = today.subtract(1, 'month').startOf('year').format('DD');
      let row = await PackageVersionDownload.findOne({ packageId: 'total', yearMonth: yesterdayYearMonthInt });
      if (!row) {
        row = await PackageVersionDownload.create({
          packageId: 'total',
          version: '*',
          yearMonth: yesterdayYearMonthInt,
        });
      }
      row[`d${yesterdayDate}`] = 1;
      await row.save();

      row = await PackageVersionDownload.findOne({ packageId: 'total', yearMonth: lastWeekYearMonthInt });
      if (!row) {
        row = await PackageVersionDownload.create({
          packageId: 'total',
          version: '*',
          yearMonth: lastWeekYearMonthInt,
        });
      }
      row[`d${lastWeekDate}`] = 1;
      await row.save();

      row = await PackageVersionDownload.findOne({ packageId: 'total', yearMonth: lastMonthYearMonthInt });
      if (!row) {
        row = await PackageVersionDownload.create({
          packageId: 'total',
          version: '*',
          yearMonth: lastMonthYearMonthInt,
        });
      }
      row[`d${lastMonthDate}`] = 1;
      await row.save();

      row = await PackageVersionDownload.findOne({ packageId: 'total', yearMonth: lastYearYearMonthInt });
      if (!row) {
        row = await PackageVersionDownload.create({
          packageId: 'total',
          version: '*',
          yearMonth: lastYearYearMonthInt,
        });
      }
      row[`d${lastYearDate}`] = 1;
      await row.save();

      await app.runSchedule('UpdateTotalData');
      res = await app.httpRequest()
        .get('/');
      assert(res.status === 200);
      data = res.body;
      assert(data.last_pacakge === '@cnpm/home2');
      assert(data.last_pacakge_version === '@cnpm/home1@1.0.1');
      assert(data.doc_count === 2);
      assert(data.doc_version_count === 3);
      assert(data.download.today === 3);
      assert(data.download.yesterday === 1);
      assert(data.download.thisweek >= 3);
      assert(data.download.thismonth >= 3);
      assert(data.download.thisyear >= 3);
      assert(data.download.lastweek >= 1);
      assert(data.download.lastmonth >= 1);
      assert(data.download.lastyear >= 1);
      // console.log(data);
    });

    it('should show sync mode = all', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'all');
      const res = await app.httpRequest()
        .get('/')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      const data = res.body;
      assert(data.sync_model === 'all');
    });

    it('should show sync enableSyncBinary = true', async () => {
      mock(app.config.cnpmcore, 'enableSyncBinary', true);
      const res = await app.httpRequest()
        .get('/')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      const data = res.body;
      assert(data.sync_binary === true);
    });
  });
});
