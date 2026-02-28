import { afterEach, beforeEach, vi } from 'vitest';

import { TestUtil } from './TestUtil.ts';

// vitest hookTimeout defaults to 10s, align with egg-bin's testTimeout (60s)
vi.setConfig({ hookTimeout: 60_000 });

beforeEach(async () => {
  // don't show console log on unittest by default
  TestUtil.app.loggers.disableConsole();
  // capture logs in memory for parallel test isolation (avoids shared log file race conditions)
  TestUtil.app.mockLog();
  await TestUtil.app.redis.flushdb('sync');
  TestUtil.allowPublicRegistration();
});

afterEach(async () => {
  await TestUtil.truncateDatabase();
  // mock.restore() handled by @eggjs/mock/setup_vitest
});
