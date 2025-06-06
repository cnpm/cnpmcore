import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { app, mock } from '@eggjs/mock/bootstrap';

import { TestUtil } from '../../../../test/TestUtil.js';
import { PackageVersionDownload } from '../../../../app/repository/model/PackageVersionDownload.js';
import dayjs from '../../../../app/common/dayjs.js';
import { RegistryManagerService } from '../../../../app/core/service/RegistryManagerService.js';
import { ChangesStreamService } from '../../../../app/core/service/ChangesStreamService.js';
import { TaskRepository } from '../../../../app/repository/TaskRepository.js';
import { TaskType } from '../../../../app/common/enum/Task.js';
import type { ChangesStreamTask } from '../../../../app/core/entity/Task.js';
import { RegistryType } from '../../../../app/common/enum/Registry.js';
import { ScopeManagerService } from '../../../../app/core/service/ScopeManagerService.js';
import type { UpstreamRegistryInfo } from '../../../../app/core/service/CacheService.js';
import { TotalRepository } from '../../../../app/repository/TotalRepository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SavePackageVersionDownloadCounterPath = path.join(
  __dirname,
  '../../../../app/port/schedule/SavePackageVersionDownloadCounter.js'
);
const UpdateTotalDataPath = path.join(
  __dirname,
  '../../../../app/port/schedule/UpdateTotalData.js'
);

describe('test/port/controller/HomeController/showTotal.test.ts', () => {
  describe('[GET /] showTotal()', () => {
    let registryManagerService: RegistryManagerService;
    let changesStreamService: ChangesStreamService;
    let taskRepository: TaskRepository;
    let totalRepository: TotalRepository;
    let scopeManagerService: ScopeManagerService;
    it('should total information', async () => {
      totalRepository = await app.getEggObject(TotalRepository);
      await totalRepository.reset();
      let res = await app.httpRequest().get('/');
      assert.ok(res.status === 200);
      assert.ok(
        res.headers['content-type'] === 'application/json; charset=utf-8'
      );
      let data = res.body;
      assert.ok(typeof data.doc_count === 'number');
      assert.ok(typeof data.doc_version_count === 'number');
      assert.ok(typeof data.download.today === 'number');
      assert.ok(data.engine === app.config.orm.client);
      assert.ok(data.node_version === process.version);
      assert.match(data.egg_version, /^\d+\.\d+\.\d+/);
      assert.ok(data.instance_start_time);
      assert.ok(data.sync_model === 'none');
      assert.ok(data.sync_binary === false);
      assert.ok(typeof data.cache_time === 'string');

      // downloads count
      const publisher = await TestUtil.createUser();
      let pkg = await TestUtil.getFullPackage({
        name: '@cnpm/home1',
        version: '1.0.0',
      });
      await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .expect(201)
        .send(pkg);

      pkg = await TestUtil.getFullPackage({
        name: '@cnpm/home2',
        version: '2.0.0',
      });

      await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .expect(201)
        .send(pkg);

      pkg = await TestUtil.getFullPackage({
        name: '@cnpm/home1',
        version: '1.0.1',
      });
      await app
        .httpRequest()
        .put(`/${pkg.name}`)
        .set('authorization', publisher.authorization)
        .set('user-agent', publisher.ua)
        .expect(201)
        .send(pkg);

      await app.httpRequest().get('/@cnpm/home1/-/home1-1.0.0.tgz');
      await app.httpRequest().get('/@cnpm/home1/-/home1-1.0.1.tgz');
      await app.httpRequest().get('/@cnpm/home2/-/home2-2.0.0.tgz');
      await app.runSchedule(SavePackageVersionDownloadCounterPath);
      await app.runSchedule(UpdateTotalDataPath);

      res = await app.httpRequest().get('/');
      assert.ok(res.status === 200);
      data = res.body;
      assert.ok(data.last_package === '@cnpm/home2');
      assert.ok(data.last_package_version === '@cnpm/home1@1.0.1');
      assert.equal(data.doc_count, 2);
      assert.ok(data.doc_version_count === 3);
      assert.ok(data.download.today === 3);
      assert.ok(data.download.yesterday === 0);
      assert.ok(data.download.thisweek === 3);
      assert.ok(data.download.thismonth === 3);
      assert.ok(data.download.thisyear === 3);
      assert.ok(data.download.lastweek === 0);
      assert.ok(data.download.lastmonth === 0);
      assert.ok(data.download.lastyear === 0);

      // mock yesterday lastweek lastmonth
      const today = dayjs();
      const yesterdayYearMonthInt = Number(
        today.subtract(1, 'day').format('YYYYMM')
      );
      const yesterdayDate = today.subtract(1, 'day').format('DD');
      const lastWeekYearMonthInt = Number(
        today.subtract(1, 'week').startOf('week').format('YYYYMM')
      );
      const lastWeekDate = today
        .subtract(1, 'week')
        .startOf('week')
        .format('DD');
      const lastMonthYearMonthInt = Number(
        today.subtract(1, 'month').startOf('month').format('YYYYMM')
      );
      const lastMonthDate = today
        .subtract(1, 'month')
        .startOf('month')
        .format('DD');
      const lastYearYearMonthInt = Number(
        today.subtract(1, 'year').startOf('year').format('YYYYMM')
      );
      const lastYearDate = today
        .subtract(1, 'month')
        .startOf('year')
        .format('DD');
      let row = await PackageVersionDownload.findOne({
        packageId: 'total',
        yearMonth: yesterdayYearMonthInt,
      });
      if (!row) {
        row = await PackageVersionDownload.create({
          packageId: 'total',
          version: '*',
          yearMonth: yesterdayYearMonthInt,
        });
      }
      // @ts-expect-error dynamic key
      row[`d${yesterdayDate}`] = 1;
      await row.save();

      row = await PackageVersionDownload.findOne({
        packageId: 'total',
        yearMonth: lastWeekYearMonthInt,
      });
      if (!row) {
        row = await PackageVersionDownload.create({
          packageId: 'total',
          version: '*',
          yearMonth: lastWeekYearMonthInt,
        });
      }
      // @ts-expect-error dynamic key
      row[`d${lastWeekDate}`] = 1;
      await row.save();

      row = await PackageVersionDownload.findOne({
        packageId: 'total',
        yearMonth: lastMonthYearMonthInt,
      });
      if (!row) {
        row = await PackageVersionDownload.create({
          packageId: 'total',
          version: '*',
          yearMonth: lastMonthYearMonthInt,
        });
      }
      // @ts-expect-error dynamic key
      row[`d${lastMonthDate}`] = 1;
      await row.save();

      row = await PackageVersionDownload.findOne({
        packageId: 'total',
        yearMonth: lastYearYearMonthInt,
      });
      if (!row) {
        row = await PackageVersionDownload.create({
          packageId: 'total',
          version: '*',
          yearMonth: lastYearYearMonthInt,
        });
      }
      // @ts-expect-error dynamic key
      row[`d${lastYearDate}`] = 1;
      await row.save();

      await app.runSchedule(UpdateTotalDataPath);
      res = await app.httpRequest().get('/');
      assert.ok(res.status === 200);
      data = res.body;
      assert.ok(data.last_package === '@cnpm/home2');
      assert.ok(data.last_package_version === '@cnpm/home1@1.0.1');
      assert.ok(data.doc_count === 2);
      assert.ok(data.doc_version_count === 3);
      assert.ok(data.download.today === 3);
      assert.ok(data.download.yesterday === 1);
      assert.ok(data.download.thisweek >= 3);
      assert.ok(data.download.thismonth >= 3);
      assert.ok(data.download.thisyear >= 3);
      assert.ok(data.download.samedayLastweek === 1);
      assert.ok(data.download.lastweek >= 1);
      assert.ok(data.download.lastmonth >= 1);
      assert.ok(data.download.lastyear >= 1);
      assert.ok(data.cache_time);
      assert.ok(data.update_seq > 0);
      // console.log(data);
    });

    it('should show sync mode = all', async () => {
      mock(app.config.cnpmcore, 'syncMode', 'all');
      const res = await app
        .httpRequest()
        .get('/')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      const data = res.body;
      assert.ok(data.sync_model === 'all');
    });

    it('should show sync enableSyncBinary = true', async () => {
      mock(app.config.cnpmcore, 'enableSyncBinary', true);
      const res = await app
        .httpRequest()
        .get('/')
        .expect(200)
        .expect('content-type', 'application/json; charset=utf-8');
      const data = res.body;
      assert.ok(data.sync_binary === true);
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
        const res = await app
          .httpRequest()
          .get('/')
          .expect(200)
          .expect('content-type', 'application/json; charset=utf-8');
        const data = res.body;
        assert.ok(data.upstream_registries.length === 0);
      });
      it('should show default registry', async () => {
        // create default registry
        await changesStreamService.findExecuteTask();

        const tasks = await taskRepository.findTasksByCondition({
          type: TaskType.ChangesStream,
        });
        await changesStreamService.executeTask(tasks[0] as ChangesStreamTask);
        assert.ok(tasks.length === 1);

        assert.ok(registryManagerService);
        await app.runSchedule(UpdateTotalDataPath);
        const res = await app
          .httpRequest()
          .get('/')
          .expect(200)
          .expect('content-type', 'application/json; charset=utf-8');
        const data = res.body;
        assert.ok(data.upstream_registries.length === 1);
        const [upstream] = data.upstream_registries;
        assert.ok(upstream.registry_name === 'default');
        assert.ok(
          upstream.changes_stream_url ===
            'https://replicate.npmjs.com/registry/_changes'
        );
        assert.ok(upstream.source_registry === 'https://registry.npmjs.org');
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
        await scopeManagerService.createScope({
          name: '@cnpm',
          registryId: registry.registryId,
        });
        await registryManagerService.createSyncChangesStream({
          registryId: registry.registryId,
        });

        // start sync
        const tasks = await taskRepository.findTasksByCondition({
          type: TaskType.ChangesStream,
        });
        assert.ok(tasks.length === 2);
        for (const task of tasks) {
          await changesStreamService.executeTask(task as ChangesStreamTask);
        }

        // refresh total
        await app.runSchedule(UpdateTotalDataPath);
        const res = await app
          .httpRequest()
          .get('/')
          .expect(200)
          .expect('content-type', 'application/json; charset=utf-8');
        const data = res.body;
        assert.ok(data.upstream_registries.length === 2);
        const defaultRegistry = data.upstream_registries.find(
          (item: UpstreamRegistryInfo) => item.registry_name === 'default'
        );
        assert.ok(defaultRegistry.registry_name === 'default');
        assert.ok(
          defaultRegistry.changes_stream_url ===
            'https://replicate.npmjs.com/registry/_changes'
        );
        assert.ok(
          defaultRegistry.source_registry === 'https://registry.npmjs.org'
        );

        const customRegistry = data.upstream_registries.find(
          (item: UpstreamRegistryInfo) => item.registry_name === 'custom'
        );
        assert.ok(customRegistry.registry_name === 'custom');
        assert.ok(
          customRegistry.changes_stream_url === 'https://r.cnpmjs.org/_changes'
        );
        assert.ok(customRegistry.source_registry === 'https://cnpmjs.org');
      });
    });
  });
});
