import assert = require('assert');
import { app, mock } from 'egg-mock/bootstrap';
import { Context } from 'egg';
import { TestUtil } from 'test/TestUtil';
import { BUG_VERSIONS } from '../../../app/common/constants';
import { CacheService } from '../../../app/core/service/CacheService';
import { BugVersionFixHandler } from '../../../app/core/event/BugVersionFixHandler';

describe('test/core/event/BugVersionFixHandler.test.ts', () => {
  let ctx: Context;
  let cacheService: CacheService;
  const fullnames: string[] = [];

  beforeEach(async () => {
    ctx = await app.mockModuleContext();
    cacheService = await ctx.getEggObject(CacheService);
    mock(app.config.cnpmcore, 'allowPublishNonScopePackage', true);
    mock(cacheService, 'removeCache', async fullname => {
      fullnames.push(fullname);
    });
    await TestUtil.createPackage({
      name: BUG_VERSIONS,
      version: '1.0.0',
      config: {
        'bug-versions': {
          faker: {
            '6.6.6': {
              version: '5.5.3',
              reason: 'Please use https://github.com/MilosPaunovic/community-faker instead',
            },
          },
        },
      },
    });
  });

  afterEach(async () => {
    await app.destroyModuleContext(ctx);
  });

  it('should clean packages cache', async () => {
    const bugVersionFixHandler = await ctx.getEggObject(BugVersionFixHandler);
    await bugVersionFixHandler.handle(BUG_VERSIONS);
    assert.deepStrictEqual(fullnames, [
      'faker',
    ]);
  });
});
