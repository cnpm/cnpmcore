import assert from 'node:assert/strict';
import { app, mock } from '@eggjs/mock/bootstrap';

import { TestUtil } from '../../../../test/TestUtil.js';
import { BugVersionService } from '../../../../app/core/service/BugVersionService.js';
import { CacheService } from '../../../../app/core/service/CacheService.js';
import { BugVersion } from '../../../../app/core/entity/BugVersion.js';

describe('test/core/service/BugVersionService/cleanBugVersionPackageCache.test.ts', () => {
  let bugVersionService: BugVersionService;
  let cacheService: CacheService;
  let bugVersion: BugVersion;
  let cleanPkgs: string[];

  beforeEach(async () => {
    cleanPkgs = [];
    bugVersionService = await app.getEggObject(BugVersionService);
    cacheService = await app.getEggObject(CacheService);
    bugVersion = new BugVersion({
      faker: {
        '6.6.6': {
          version: '5.5.3',
          reason:
            'Please use https://github.com/MilosPaunovic/community-faker instead',
        },
      },
      colors: {
        '1.4.44-liberty-2': {
          version: '1.4.0',
          reason: 'https://github.com/Marak/colors.js/issues/285',
        },
        '1.4.1': {
          version: '1.4.0',
          reason: 'https://github.com/Marak/colors.js/issues/285',
        },
        '1.4.2': {
          version: '1.4.0',
          reason: 'https://github.com/Marak/colors.js/issues/289',
        },
      },
    });
    mock(cacheService, 'removeCache', async (fullname: string) => {
      cleanPkgs.push(fullname);
    });
  });

  afterEach(async () => {
    mock.restore();
    await TestUtil.truncateDatabase();
  });

  it('should clean all packages has bug version', async () => {
    await bugVersionService.cleanBugVersionPackageCaches(bugVersion);
    assert.deepStrictEqual(cleanPkgs, ['faker', 'colors']);
  });
});
