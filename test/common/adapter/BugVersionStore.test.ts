import assert = require('assert');
import { app } from 'egg-mock/bootstrap';
import { BugVersionStore } from '../../../app/common/adapter/BugVersionStore';
import { BugVersion } from '../../../app/core/entity/BugVersion';

describe('test/common/adapter/BugVersionStore.test.ts', () => {
  let bugVersionStore: BugVersionStore;
  const bugVersion = new BugVersion({});
  const version = '1.0.0';

  beforeEach(async () => {
    bugVersionStore = await app.getEggObject(BugVersionStore);
    bugVersionStore.setBugVersion(bugVersion, version);
  });

  describe('getBugVersion', () => {
    describe('version hit', () => {
      it('should return bug version', () => {
        const cache = bugVersionStore.getBugVersion(version);
        assert(cache === bugVersion);
      });
    });

    describe('version miss', () => {
      it('should return undefined', () => {
        const cache = bugVersionStore.getBugVersion('1.0.1');
        assert(!cache);
      });
    });
  });
});
