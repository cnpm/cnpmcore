import assert from 'assert';
import { app, mock } from 'egg-mock/bootstrap';
import { BUG_VERSIONS } from '../../../app/common/constants';
import { CacheService } from '../../../app/core/service/CacheService';
import { BugVersionFixHandler } from '../../../app/core/event/BugVersionFixHandler';
import { BugVersion } from '../../../app/core/entity/BugVersion';
import { BugVersionService } from '../../../app/core/service/BugVersionService';

describe('test/core/event/BugVersionFixHandler.test.ts', () => {
  let cacheService: CacheService;
  let bugVersionService: BugVersionService;
  const fullnames: string[] = [];

  beforeEach(async () => {
    cacheService = await app.getEggObject(CacheService);
    bugVersionService = await app.getEggObject(BugVersionService);
    mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
    mock(cacheService, 'removeCache', async fullname => {
      fullnames.push(fullname);
    });
    mock(bugVersionService, 'getBugVersion', async () => {
      return new BugVersion({
        faker: {
          '6.6.6': {
            version: '5.5.3',
            reason: 'Please use https://github.com/MilosPaunovic/community-faker instead',
          },
        },
      });
    });
  });

  it('should clean packages cache', async () => {
    const bugVersionFixHandler = await app.getEggObject(BugVersionFixHandler);
    await bugVersionFixHandler.handle(BUG_VERSIONS);
    assert.deepStrictEqual(fullnames, [
      'faker',
    ]);
  });
});
