import { afterEach, beforeEach, vi } from 'vite-plus/test';

import { PackageManagerService } from '../app/core/service/PackageManagerService.ts';
import { TestUtil } from './TestUtil.ts';

// egg-bin inlines dependencies in Vitest, but Leoric 2.15's ESM entry also assigns to module.exports.
// Load its CommonJS condition so Vitest does not evaluate those incompatible module semantics together.
// Remove this mock once cnpmcore requires a Leoric release containing https://github.com/cyjake/leoric/pull/499.
vi.mock('leoric', async () => {
  const { createRequire } = await import('node:module');
  const leoric = createRequire(import.meta.url)('leoric') as typeof import('leoric');
  return { ...leoric, default: leoric };
});

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
  try {
    await TestUtil.truncateDatabase();
  } finally {
    // Reset in-memory download counters to prevent cross-test pollution
    PackageManagerService.resetDownloadCounters();
  }
  // mock.restore() handled by @eggjs/mock/setup_vitest
});
