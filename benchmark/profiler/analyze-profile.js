#!/usr/bin/env node
/**
 * CPU Profile Analyzer for xprofiler/V8 CPU profiles
 * Usage: node analyze-profile.js <profile.cpuprofile>
 */

import fs from 'node:fs';

const profilePath = process.argv[2];

if (!profilePath) {
  console.error('Usage: node analyze-profile.js <profile.cpuprofile>');
  process.exit(1);
}

if (!fs.existsSync(profilePath)) {
  console.error('Profile file not found:', profilePath);
  process.exit(1);
}

const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));

// Build node map for quick lookup
const nodeMap = new Map();
profile.nodes.forEach((node) => nodeMap.set(node.id, node));

// Calculate basic statistics
const totalHits = profile.nodes.reduce((sum, n) => sum + n.hitCount, 0);
const idleNode = profile.nodes.find((n) => n.callFrame.functionName === '(idle)');
const programNode = profile.nodes.find((n) => n.callFrame.functionName === '(program)');
const gcNode = profile.nodes.find((n) => n.callFrame.functionName === '(garbage collector)');

const idleHits = idleNode ? idleNode.hitCount : 0;
const programHits = programNode ? programNode.hitCount : 0;
const gcHits = gcNode ? gcNode.hitCount : 0;
const activeHits = totalHits - idleHits - programHits - gcHits;

console.log('='.repeat(100));
console.log('CPU Profile Analysis Report');
console.log('='.repeat(100));
console.log('\n## Profile Information\n');
console.log(`- Profile Type: ${profile.typeId}`);
console.log(`- Title: ${profile.title}`);
console.log(`- Total Nodes: ${profile.nodes.length}`);
console.log(`- Duration: ${((profile.endTime - profile.startTime) / 1000000).toFixed(2)} seconds`);
console.log(`- Sample Count: ${profile.samples ? profile.samples.length : 'N/A'}`);

console.log('\n## CPU Time Distribution\n');
console.log(`- Total Samples: ${totalHits}`);
console.log(`- Idle Time: ${idleHits} (${((idleHits / totalHits) * 100).toFixed(2)}%)`);
console.log(`- Program Time: ${programHits} (${((programHits / totalHits) * 100).toFixed(2)}%)`);
console.log(`- GC Time: ${gcHits} (${((gcHits / totalHits) * 100).toFixed(2)}%)`);
console.log(`- Active/User Time: ${activeHits} (${((activeHits / totalHits) * 100).toFixed(2)}%)`);

// Get top functions by self time
const excluded = ['(idle)', '(root)', '(program)', '(garbage collector)'];
const topBySelf = profile.nodes
  .filter((n) => n.hitCount > 0 && excluded.indexOf(n.callFrame.functionName) === -1)
  .sort((a, b) => b.hitCount - a.hitCount)
  .slice(0, 30);

console.log('\n## Top 30 Functions by Self Time\n');
console.log('| Rank | Hits | % of Active | Function | Location |');
console.log('|------|------|-------------|----------|----------|');

topBySelf.forEach((node, idx) => {
  const pct = ((node.hitCount / activeHits) * 100).toFixed(2);
  const url = node.callFrame.url || '(native)';
  let location;
  if (url.includes('node:')) {
    location = url;
  } else if (url) {
    const parts = url.split('/');
    location = parts.slice(-3).join('/');
  } else {
    location = '(native)';
  }
  console.log(
    `| ${idx + 1} | ${node.hitCount} | ${pct}% | ${node.callFrame.functionName} | ${location}:${node.callFrame.lineNumber} |`,
  );
});

// Aggregate by file/module
const fileStats = new Map();
profile.nodes.forEach((node) => {
  if (node.hitCount === 0) return;
  if (excluded.indexOf(node.callFrame.functionName) !== -1) return;

  let url = node.callFrame.url || '(native)';

  // Normalize file path
  if (url.includes('node_modules')) {
    // Extract package name
    const match = url.match(/node_modules\/_?([^@][^/]*|@[^/]+\/[^/]+)/);
    if (match) {
      url = 'node_modules/' + match[1];
    }
  } else if (url.includes('node:')) {
    url = url;
  } else if (url) {
    // Application code - get relative path
    const appMatch = url.match(/application\/(.+)/);
    if (appMatch) {
      url = appMatch[1];
    }
  }

  const current = fileStats.get(url) || { hits: 0, functions: new Set() };
  current.hits += node.hitCount;
  current.functions.add(node.callFrame.functionName);
  fileStats.set(url, current);
});

const sortedFiles = Array.from(fileStats.entries())
  .sort((a, b) => b[1].hits - a[1].hits)
  .slice(0, 30);

console.log('\n## Top 30 Files/Modules by CPU Time\n');
console.log('| Rank | Hits | % of Active | File/Module | Function Count |');
console.log('|------|------|-------------|-------------|----------------|');

sortedFiles.forEach(([file, stats], idx) => {
  const pct = ((stats.hits / activeHits) * 100).toFixed(2);
  console.log(`| ${idx + 1} | ${stats.hits} | ${pct}% | ${file} | ${stats.functions.size} |`);
});

// Categorize by type
const categories = {
  'Node.js Core': 0,
  'NPM Packages': 0,
  'Application Code': 0,
  'Native/V8': 0,
};

profile.nodes.forEach((node) => {
  if (node.hitCount === 0) return;
  if (excluded.indexOf(node.callFrame.functionName) !== -1) return;

  const url = node.callFrame.url || '';

  if (url.includes('node:')) {
    categories['Node.js Core'] += node.hitCount;
  } else if (url.includes('node_modules')) {
    categories['NPM Packages'] += node.hitCount;
  } else if (url === '' || url === '(native)') {
    categories['Native/V8'] += node.hitCount;
  } else {
    categories['Application Code'] += node.hitCount;
  }
});

console.log('\n## CPU Time by Category\n');
console.log('| Category | Hits | % of Active |');
console.log('|----------|------|-------------|');

Object.entries(categories)
  .sort((a, b) => b[1] - a[1])
  .forEach(([cat, hits]) => {
    const pct = ((hits / activeHits) * 100).toFixed(2);
    console.log(`| ${cat} | ${hits} | ${pct}% |`);
  });

// Find application code hotspots
console.log('\n## Application Code Hotspots\n');
const appFunctions = profile.nodes
  .filter((n) => {
    if (n.hitCount === 0) return false;
    if (excluded.indexOf(n.callFrame.functionName) !== -1) return false;
    const url = n.callFrame.url || '';
    return url.includes('application/') && !url.includes('node_modules');
  })
  .sort((a, b) => b.hitCount - a.hitCount)
  .slice(0, 20);

if (appFunctions.length > 0) {
  console.log('| Rank | Hits | % | Function | File | Line |');
  console.log('|------|------|---|----------|------|------|');

  appFunctions.forEach((node, idx) => {
    const pct = ((node.hitCount / activeHits) * 100).toFixed(2);
    const url = node.callFrame.url || '';
    const file = url.match(/application\/(.+)/)?.[1] || url;
    console.log(
      `| ${idx + 1} | ${node.hitCount} | ${pct}% | ${node.callFrame.functionName} | ${file} | ${node.callFrame.lineNumber} |`,
    );
  });
} else {
  console.log('No application code hotspots found.');
}

// Find npm package hotspots
console.log('\n## NPM Package Hotspots\n');
const npmFunctions = profile.nodes
  .filter((n) => {
    if (n.hitCount === 0) return false;
    if (excluded.indexOf(n.callFrame.functionName) !== -1) return false;
    const url = n.callFrame.url || '';
    return url.includes('node_modules');
  })
  .sort((a, b) => b.hitCount - a.hitCount)
  .slice(0, 20);

if (npmFunctions.length > 0) {
  console.log('| Rank | Hits | % | Function | Package | Line |');
  console.log('|------|------|---|----------|---------|------|');

  npmFunctions.forEach((node, idx) => {
    const pct = ((node.hitCount / activeHits) * 100).toFixed(2);
    const url = node.callFrame.url || '';
    const pkgMatch = url.match(/node_modules\/_?([^@][^/]*|@[^/]+\/[^/]+)/);
    const pkg = pkgMatch ? pkgMatch[1] : 'unknown';
    console.log(
      `| ${idx + 1} | ${node.hitCount} | ${pct}% | ${node.callFrame.functionName} | ${pkg} | ${node.callFrame.lineNumber} |`,
    );
  });
} else {
  console.log('No NPM package hotspots found.');
}

// Build call tree for total time analysis
function calculateTotalTime(nodeId, visited = new Set()) {
  if (visited.has(nodeId)) return 0;
  visited.add(nodeId);

  const node = nodeMap.get(nodeId);
  if (!node) return 0;

  let total = node.hitCount;
  if (node.children) {
    node.children.forEach((childId) => {
      total += calculateTotalTime(childId, visited);
    });
  }
  return total;
}

// Find root level callers with high total time
console.log('\n## Top Entry Points by Total Time\n');
const rootNode = profile.nodes.find((n) => n.callFrame.functionName === '(root)');
if (rootNode && rootNode.children) {
  const entryPoints = rootNode.children
    .map((childId) => {
      const node = nodeMap.get(childId);
      if (!node) return null;
      const totalTime = calculateTotalTime(childId);
      return { node, totalTime };
    })
    .filter((x) => x && excluded.indexOf(x.node.callFrame.functionName) === -1)
    .sort((a, b) => b.totalTime - a.totalTime)
    .slice(0, 15);

  console.log('| Rank | Total | % | Self | Function | Location |');
  console.log('|------|-------|---|------|----------|----------|');

  entryPoints.forEach((entry, idx) => {
    const node = entry.node;
    const pct = ((entry.totalTime / activeHits) * 100).toFixed(2);
    const url = node.callFrame.url || '(native)';
    let location = url.includes('node:') ? url : url.split('/').slice(-2).join('/');
    console.log(
      `| ${idx + 1} | ${entry.totalTime} | ${pct}% | ${node.hitCount} | ${node.callFrame.functionName} | ${location}:${node.callFrame.lineNumber} |`,
    );
  });
}

console.log('\n' + '='.repeat(100));
console.log('End of Report');
console.log('='.repeat(100));
