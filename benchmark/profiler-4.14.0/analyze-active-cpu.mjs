#!/usr/bin/env node

/**
 * Active CPU Analysis - focuses on actual work excluding idle time
 */

import fs from 'node:fs';
import path from 'node:path';

const PROFILE_PATH = process.argv[2] || path.join(
  process.env.HOME,
  'Downloads/cnpmcore/4.14.0/registry-npmmirror-x-cpuprofile-870954-20251209-0.cpuprofile'
);

const content = fs.readFileSync(PROFILE_PATH, 'utf-8');
const profile = JSON.parse(content);

const nodeMap = new Map(profile.nodes.map(n => [n.id, n]));

// Calculate total and active samples
const totalSamples = profile.nodes.reduce((sum, n) => sum + (n.hitCount || 0), 0);
const idleNode = profile.nodes.find(n => n.callFrame.functionName === '(idle)');
const idleSamples = idleNode?.hitCount || 0;
const activeSamples = totalSamples - idleSamples;

console.log('=== Active CPU Analysis ===\n');
console.log(`Total samples: ${totalSamples}`);
console.log(`Idle samples: ${idleSamples} (${((idleSamples / totalSamples) * 100).toFixed(2)}%)`);
console.log(`Active samples: ${activeSamples} (${((activeSamples / totalSamples) * 100).toFixed(2)}%)`);
console.log(`\n--- Analysis based on ACTIVE CPU time ---\n`);

// Get all functions excluding special ones
const functionStats = new Map();

for (const node of profile.nodes) {
  const { callFrame, hitCount } = node;
  if (hitCount === 0) continue;
  if (['(idle)', '(program)', '(garbage collector)', 'runMicrotasks'].includes(callFrame.functionName)) continue;

  const key = `${callFrame.functionName}@${callFrame.url}:${callFrame.lineNumber}`;
  if (!functionStats.has(key)) {
    functionStats.set(key, {
      functionName: callFrame.functionName,
      url: callFrame.url,
      lineNumber: callFrame.lineNumber,
      selfTime: 0
    });
  }
  functionStats.get(key).selfTime += hitCount;
}

// Sort by self time
const sorted = [...functionStats.values()]
  .sort((a, b) => b.selfTime - a.selfTime);

// Calculate active time (excluding idle, program, gc, microtasks)
const specialSamples = profile.nodes
  .filter(n => ['(idle)', '(program)', '(garbage collector)', 'runMicrotasks'].includes(n.callFrame.functionName))
  .reduce((sum, n) => sum + (n.hitCount || 0), 0);

const realActiveSamples = totalSamples - specialSamples;

console.log(`Real active samples (excluding idle/gc/program/microtasks): ${realActiveSamples}`);
console.log(`\n=== Top 30 Functions by Active CPU Time ===\n`);

console.log('| Rank | Function | Location | Samples | % of Active |');
console.log('|------|----------|----------|---------|-------------|');

sorted.slice(0, 30).forEach((fn, i) => {
  const basename = fn.url ? fn.url.split('/').pop() : '(native)';
  const location = `${basename}:${fn.lineNumber}`;
  const percentage = ((fn.selfTime / realActiveSamples) * 100).toFixed(2);
  console.log(`| ${i + 1} | ${fn.functionName || '(anonymous)'} | ${location} | ${fn.selfTime} | ${percentage}% |`);
});

// Categorize by source with active CPU
console.log('\n\n=== Category Breakdown (Active CPU Only) ===\n');

const categories = {
  'egg/tegg': { selfTime: 0, functions: [] },
  'leoric (ORM)': { selfTime: 0, functions: [] },
  'mysql2 (driver)': { selfTime: 0, functions: [] },
  'cnpmcore (app)': { selfTime: 0, functions: [] },
  'koa/router': { selfTime: 0, functions: [] },
  'node internals': { selfTime: 0, functions: [] },
  'reflect-metadata': { selfTime: 0, functions: [] },
  'V8/native (other)': { selfTime: 0, functions: [] },
  'other': { selfTime: 0, functions: [] },
};

for (const fn of sorted) {
  let category;
  const url = fn.url || '';

  if (url.includes('leoric')) {
    category = 'leoric (ORM)';
  } else if (url.includes('mysql2')) {
    category = 'mysql2 (driver)';
  } else if (url.includes('/app/') || url.includes('cnpmcore')) {
    category = 'cnpmcore (app)';
  } else if (url.includes('tegg') || url.includes('egg')) {
    category = 'egg/tegg';
  } else if (url.includes('koa') || url.includes('router') || url.includes('Router')) {
    category = 'koa/router';
  } else if (url.includes('reflect-metadata') || url.includes('Reflect')) {
    category = 'reflect-metadata';
  } else if (url.includes('node:')) {
    category = 'node internals';
  } else if (!url || url === '') {
    category = 'V8/native (other)';
  } else {
    category = 'other';
  }

  categories[category].selfTime += fn.selfTime;
  categories[category].functions.push(fn);
}

const sortedCategories = Object.entries(categories)
  .map(([name, data]) => ({
    name,
    selfTime: data.selfTime,
    percentage: ((data.selfTime / realActiveSamples) * 100).toFixed(2),
    functions: data.functions
  }))
  .sort((a, b) => b.selfTime - a.selfTime);

console.log('| Category | Samples | % of Active | Top Function |');
console.log('|----------|---------|-------------|--------------|');

for (const cat of sortedCategories) {
  const topFn = cat.functions[0]?.functionName || 'N/A';
  console.log(`| ${cat.name} | ${cat.selfTime} | ${cat.percentage}% | ${topFn} |`);
}

// Detailed breakdown per category
console.log('\n\n=== Detailed Category Analysis ===\n');

for (const cat of sortedCategories.filter(c => c.selfTime > 100)) {
  console.log(`\n### ${cat.name} (${cat.percentage}% of active CPU)`);
  console.log('Top 5 functions:');
  cat.functions.slice(0, 5).forEach((fn, i) => {
    const basename = fn.url ? fn.url.split('/').pop() : '(native)';
    const pct = ((fn.selfTime / realActiveSamples) * 100).toFixed(2);
    console.log(`  ${i + 1}. ${fn.functionName || '(anonymous)'} - ${fn.selfTime} samples (${pct}%) @ ${basename}:${fn.lineNumber}`);
  });
}

// Special analysis: Request handling path
console.log('\n\n=== Request Handling Overhead Analysis ===\n');

const requestHandling = sorted.filter(fn => {
  const url = fn.url || '';
  return url.includes('router') || url.includes('Router') ||
         url.includes('middleware') || url.includes('dispatch') ||
         url.includes('Layer') || url.includes('koa');
});

const requestOverhead = requestHandling.reduce((sum, fn) => sum + fn.selfTime, 0);
console.log(`Request handling overhead: ${requestOverhead} samples (${((requestOverhead / realActiveSamples) * 100).toFixed(2)}% of active CPU)`);

// ORM overhead
const ormOverhead = sorted.filter(fn => {
  const url = fn.url || '';
  return url.includes('leoric') || url.includes('bone') || url.includes('spell') ||
         (fn.functionName && fn.functionName.includes('Bone'));
});

const ormSamples = ormOverhead.reduce((sum, fn) => sum + fn.selfTime, 0);
console.log(`ORM (Leoric) overhead: ${ormSamples} samples (${((ormSamples / realActiveSamples) * 100).toFixed(2)}% of active CPU)`);

// Database driver overhead
const dbDriverOverhead = sorted.filter(fn => {
  const url = fn.url || '';
  return url.includes('mysql2') || url.includes('pg') || url.includes('query');
});

const dbSamples = dbDriverOverhead.reduce((sum, fn) => sum + fn.selfTime, 0);
console.log(`Database driver overhead: ${dbSamples} samples (${((dbSamples / realActiveSamples) * 100).toFixed(2)}% of active CPU)`);

// Tegg/DI overhead
const teggOverhead = sorted.filter(fn => {
  const url = fn.url || '';
  return url.includes('tegg') || url.includes('inject') || url.includes('EggObject') ||
         url.includes('lifecycle') || url.includes('Lifecycle');
});

const teggSamples = teggOverhead.reduce((sum, fn) => sum + fn.selfTime, 0);
console.log(`Tegg/DI overhead: ${teggSamples} samples (${((teggSamples / realActiveSamples) * 100).toFixed(2)}% of active CPU)`);

console.log('\n\n=== Optimization Opportunities ===\n');

// Generate specific recommendations
console.log('Based on active CPU analysis:\n');

if (ormSamples > realActiveSamples * 0.1) {
  console.log('1. **HIGH PRIORITY: Leoric ORM Overhead**');
  console.log(`   - ORM consumes ${((ormSamples / realActiveSamples) * 100).toFixed(1)}% of active CPU`);
  console.log('   - The Bone constructor is called frequently during result instantiation');
  console.log('   - Consider: Batch queries, raw SQL for bulk ops, or Bone constructor optimization');
  console.log('');
}

if (teggSamples > realActiveSamples * 0.05) {
  console.log('2. **MEDIUM PRIORITY: Tegg/DI Overhead**');
  console.log(`   - Dependency injection consumes ${((teggSamples / realActiveSamples) * 100).toFixed(1)}% of active CPU`);
  console.log('   - Context creation and property injection add overhead per request');
  console.log('   - Consider: Singleton services where possible, reduce per-request DI');
  console.log('');
}

if (requestOverhead > realActiveSamples * 0.05) {
  console.log('3. **MEDIUM PRIORITY: Request Routing Overhead**');
  console.log(`   - Router/middleware dispatch consumes ${((requestOverhead / realActiveSamples) * 100).toFixed(1)}% of active CPU`);
  console.log('   - Layer matching and middleware chain add overhead');
  console.log('   - Consider: Route optimization, reduce middleware chain length');
  console.log('');
}

// Write summary JSON
const summary = {
  totalSamples,
  idleSamples,
  activeSamples: realActiveSamples,
  cpuUtilization: ((realActiveSamples / totalSamples) * 100).toFixed(2) + '%',
  categories: sortedCategories.map(c => ({
    name: c.name,
    samples: c.selfTime,
    percentage: c.percentage + '%'
  })),
  overheadBreakdown: {
    orm: { samples: ormSamples, percentage: ((ormSamples / realActiveSamples) * 100).toFixed(2) + '%' },
    teggDI: { samples: teggSamples, percentage: ((teggSamples / realActiveSamples) * 100).toFixed(2) + '%' },
    requestHandling: { samples: requestOverhead, percentage: ((requestOverhead / realActiveSamples) * 100).toFixed(2) + '%' },
    dbDriver: { samples: dbSamples, percentage: ((dbSamples / realActiveSamples) * 100).toFixed(2) + '%' }
  }
};

const OUTPUT_DIR = path.dirname(new URL(import.meta.url).pathname);
fs.writeFileSync(path.join(OUTPUT_DIR, 'active-cpu-summary.json'), JSON.stringify(summary, null, 2));
console.log('\nSummary written to active-cpu-summary.json');
