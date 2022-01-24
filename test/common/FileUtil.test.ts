import assert = require('assert');
import { downloadToTempfile } from '../../app/common/FileUtil';
import { app } from 'egg-mock/bootstrap';

describe('test/common/FileUtil.test.ts', () => {
  const sourceUrl = 'https://github.com/cnpm/cnpmcore/archive/refs/heads/main.zip';
  describe('should show download progress', () => {
    it('should work', async () => {
      await downloadToTempfile(app.httpclient, app.config.dataDir, sourceUrl!);
      assert(true);
    });
  });
});
