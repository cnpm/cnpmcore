const { PerformanceObserver, constants } = require('node:perf_hooks');

const gcStats = {
  totalGCDuration: 0, // ms
  count: 0,
  byKind: {
    scavenge: 0, // minor GC
    markSweepCompact: 0, // major GC
    incremental: 0,
    weakc: 0,
    unknown: 0,
  },
};

// kind meaning: https://nodejs.org/api/perf_hooks.html#performancegc_kind
// 1: scavenge
// 2: mark-sweep-compact
// 4: incremental
// 8: weak callbacks
function kindToString(kind) {
  switch (kind) {
    case constants.NODE_PERFORMANCE_GC_MAJOR:
      return 'markSweepCompact';
    case constants.NODE_PERFORMANCE_GC_MINOR:
      return 'scavenge';
    case constants.NODE_PERFORMANCE_GC_INCREMENTAL:
      return 'incremental';
    case constants.NODE_PERFORMANCE_GC_WEAKCB:
      return 'weakc';
    default:
      return 'unknown';
  }
}

const obs = new PerformanceObserver((list) => {
  const entries = list.getEntries();
  for (const entry of entries) {
    gcStats.totalGCDuration += entry.duration;
    gcStats.count += 1;

    const kindCode = entry.detail?.kind;
    const kind = kindToString(kindCode);
    if (!gcStats.byKind[kind]) gcStats.byKind[kind] = 0;
    gcStats.byKind[kind] += entry.duration;
  }
});

obs.observe({ entryTypes: ['gc'] });

// for other modules to use
function getGCStats() {
  return {
    totalGCDuration: gcStats.totalGCDuration,
    count: gcStats.count,
    avgDuration: gcStats.count ? gcStats.totalGCDuration / gcStats.count : 0,
    byKind: { ...gcStats.byKind },
  };
}

// only print GC stats if the GC environment variable is set
if (process.env.GC || true) {
  setInterval(() => {
    const stats = getGCStats();
    console.log('');
    console.log(
      '[GC]',
      'total(ms)=',
      stats.totalGCDuration.toFixed(2),
      'count=',
      stats.count,
      'avg(ms)=',
      stats.avgDuration.toFixed(2),
      'byKind=',
      stats.byKind,
    );
    // process memory usage
    console.log('process memory usage=', process.memoryUsage());
  }, 2000);
}
