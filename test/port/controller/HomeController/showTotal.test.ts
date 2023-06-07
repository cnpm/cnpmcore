import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { TestUtil } from '../../../../test/TestUtil';
import { PackageVersionDownload } from '../../../../app/repository/model/PackageVersionDownload';
import dayjs from '../../../../app/common/dayjs';
import { RegistryManagerService } from '../../../../app/core/service/RegistryManagerService';
import { ChangesStreamService } from '../../../../app/core/service/ChangesStreamService';
import { TaskRepository } from '../../../../app/repository/TaskRepository';
import { TaskType } from '../../../../app/common/enum/Task';
import { ChangesStreamTask } from '../../../../app/core/entity/Task';
import { RegistryType } from '../../../../app/common/enum/Registry';
import { ScopeManagerService } from '../../../../app/core/service/ScopeManagerService';

const SavePackageVersionDownloadCounterPath = require.resolve('../../../../app/port/schedule/SavePackageVersionDownloadCounter');
const UpdateTotalDataPath = require.resolve('../../../../app/port/schedule/UpdateTotalData');

describe('test/port/controller/HomeController/showTotal.test.ts', () => {
  describe('[GET /] showTotal()', () => {
    let registryManagerService: RegistryManagerService;
    let changesStreamService: ChangesStreamService;
    let taskRepository: TaskRepository;
    let scopeManagerService: ScopeManagerService;
    it('should total information', async () => {
      let res = await app.httpRequest()
        .get('/');
      assert(res.status === 200);
      assert(res.headers['content-type'] === 'application/json; charset=utf-8');
      let data = res.body;
      assert(typeof data.doc_count === 'number');
      assert(typeof data.doc_version_count === 'number');
      assert(typeof data.download.today === 'number');
      assert(data.engine === app.config.orm.client);
      assert(data.node_version === process.version);
      assert(data.instance_start_time);
      assert(data.sync_model === 'none');
      assert(data.sync_binary === false);
      assert(typeof data.cache_time === 'string');

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
      await app.runSchedule(SavePackageVersionDownloadCounterPath);
      await app.runSchedule(UpdateTotalDataPath);


      res = await app.httpRequest()
        .get('/');
      assert(res.status === 200);
      data = res.body;
      assert(data.last_package === '@cnpm/home2');
      assert(data.last_package_version === '@cnpm/home1@1.0.1');
      assert.equal(data.doc_count, 2);
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

      await app.runSchedule(UpdateTotalDataPath);
      res = await app.httpRequest()
        .get('/');
      assert(res.status === 200);
      data = res.body;
      assert(data.last_package === '@cnpm/home2');
      assert(data.last_package_version === '@cnpm/home1@1.0.1');
      assert(data.doc_count === 2);
      assert(data.doc_version_count === 3);
      assert(data.download.today === 3);
      assert(data.download.yesterday === 1);
      assert(data.download.thisweek >= 3);
      assert(data.download.thismonth >= 3);
      assert(data.download.thisyear >= 3);
      assert(data.download.samedayLastweek === 1);
      assert(data.download.lastweek >= 1);
      assert(data.download.lastmonth >= 1);
      assert(data.download.lastyear >= 1);
      assert(data.cache_time);
      assert(data.update_seq > 0);
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

    describe('upstream_registries', async () => {
      beforeEach(async () => {
        registryManagerService = await app.getEggObject(RegistryManagerService);
        changesStreamService = await app.getEggObject(ChangesStreamService);
        taskRepository = await app.getEggObject(TaskRepository);
        scopeManagerService = await app.getEggObject(ScopeManagerService);
        await app.runSchedule(UpdateTotalDataPath);
      });
      it('should show empty upstream_registries when no changesStreamTasks', async () => {
        const res = await app.httpRequest()
          .get('/')
          .expect(200)
          .expect('content-type', 'application/json; charset=utf-8');
        const data = res.body;
        assert(data.upstream_registries.length === 0);
      });
      it('should show default registry', async () => {
        // create default registry
        await changesStreamService.findExecuteTask();

        const tasks = await taskRepository.findTasksByCondition({ type: TaskType.ChangesStream });
        await changesStreamService.executeTask(tasks[0] as ChangesStreamTask);
        assert(tasks.length === 1);

        assert(registryManagerService);
        await app.runSchedule(UpdateTotalDataPath);
        const res = await app.httpRequest()
          .get('/')
          .expect(200)
          .expect('content-type', 'application/json; charset=utf-8');
        const data = res.body;
        assert(data.upstream_registries.length === 1);
        const [ upstream ] = data.upstream_registries;
        assert(upstream.registry_name === 'default');
        assert(upstream.changes_stream_url === 'https://replicate.npmjs.com/_changes');
        assert(upstream.source_registry === 'https://registry.npmjs.org');
      });

      it('should show custom registry', async () => {
        // create default registry
        await changesStreamService.findExecuteTask();

        // create registry
        const registry = await registryManagerService.createRegistry({
          name: 'custom',
          changeStream: 'https://r.cnpmjs.org/_changes',
          host: 'https://cnpmjs.org',
          userPrefix: 'cnpm:',
          type: RegistryType.Cnpmcore,
        });
        await scopeManagerService.createScope({ name: '@cnpm', registryId: registry.registryId });
        await registryManagerService.createSyncChangesStream({ registryId: registry.registryId });

        // start sync
        const tasks = await taskRepository.findTasksByCondition({ type: TaskType.ChangesStream });
        assert(tasks.length === 2);
        for (const task of tasks) {
          await changesStreamService.executeTask(task as ChangesStreamTask);
        }

        // refresh total
        await app.runSchedule(UpdateTotalDataPath);
        const res = await app.httpRequest()
          .get('/')
          .expect(200)
          .expect('content-type', 'application/json; charset=utf-8');
        const data = res.body;
        assert(data.upstream_registries.length === 2);
        const [ defaultRegistry ] = data.upstream_registries.filter(item => item.registry_name === 'default');
        assert(defaultRegistry.registry_name === 'default');
        assert(defaultRegistry.changes_stream_url === 'https://replicate.npmjs.com/_changes');
        assert(defaultRegistry.source_registry === 'https://registry.npmjs.org');

        const [ customRegistry ] = data.upstream_registries.filter(item => item.registry_name === 'custom');
        assert(customRegistry.registry_name === 'custom');
        assert(customRegistry.changes_stream_url === 'https://r.cnpmjs.org/_changes');
        assert(customRegistry.source_registry === 'https://cnpmjs.org');

      });
    });

  });
});
