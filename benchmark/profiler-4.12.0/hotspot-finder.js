#!/usr/bin/env node
/**
 * Find performance hotspots in CPU profile with detailed call paths
 *
 * Usage: node hotspot-finder.js <profile.cpuprofile> [--filter=pattern] [--top=N]
 */

import fs from 'node:fs';

const args = process.argv.slice(2);
let profilePath = null;
let filterPattern = null;
let topN = 20;

for (const arg of args) {
  if (arg.startsWith('--filter=')) {
    filterPattern = arg.substring(9);
  } else if (arg.startsWith('--top=')) {
    topN = parseInt(arg.substring(6), 10);
  } else if (!arg.startsWith('--')) {
    profilePath = arg;
  }
}

if (!profilePath) {
  console.error('Usage: node hotspot-finder.js <profile.cpuprofile> [--filter=pattern] [--top=N]');
  console.error('');
  console.error('Options:');
  console.error('  --filter=pattern  Filter functions by pattern (e.g., "leoric", "cnpmcore")');
  console.error('  --top=N           Show top N results (default: 20)');
  process.exit(1);
}

if (!fs.existsSync(profilePath)) {
  console.error('Profile file not found:', profilePath);
  process.exit(1);
}

const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));

// Build node map
const nodeMap = new Map();
profile.nodes.forEach((node) => nodeMap.set(node.id, node));

// Build parent map
const parentMap = new Map();
profile.nodes.forEach((node) => {
  if (node.children) {
    node.children.forEach((childId) => {
      parentMap.set(childId, node.id);
    });
  }
});

// Get caller chain
function getCallerChain(nodeId, maxDepth = 5) {
  const chain = [];
  let currentId = parentMap.get(nodeId);
  let depth = 0;

  while (currentId && depth < maxDepth) {
    const node = nodeMap.get(currentId);
    if (!node) break;

    const cf = node.callFrame;
    const name = cf.functionName || '(anonymous)';
    const url = cf.url || '';

    // Skip internal/system nodes
    if (name !== '(root)' && name !== '(idle)' && name !== '(program)') {
      let location = '';
      if (url.includes('node_modules')) {
        const match = url.match(/node_modules\/_?([^@][^/]*|@[^/]+\/[^/]+)/);
        location = match ? match[1] : url.split('/').slice(-2).join('/');
      } else if (url.includes('node:')) {
        location = url;
      } else if (url) {
        location = url.split('/').slice(-2).join('/');
      }

      chain.push({
        name,
        location: location ? `${location}:${cf.lineNumber}` : '(native)',
      });
    }

    currentId = parentMap.get(currentId);
    depth++;
  }

  return chain;
}

// Calculate total time including children
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

// Calculate total active time
const excluded = ['(idle)', '(root)', '(program)', '(garbage collector)'];
const totalActive = profile.nodes.reduce((sum, n) => {
  if (excluded.indexOf(n.callFrame.functionName) !== -1) return sum;
  return sum + n.hitCount;
}, 0);

// Find hotspots
let hotspots = profile.nodes
  .filter((n) => {
    if (n.hitCount === 0) return false;
    if (excluded.indexOf(n.callFrame.functionName) !== -1) return false;

    if (filterPattern) {
      const url = n.callFrame.url || '';
      const name = n.callFrame.functionName || '';
      const regex = new RegExp(filterPattern, 'i');
      return regex.test(url) || regex.test(name);
    }
    return true;
  })
  .map((node) => ({
    node,
    selfTime: node.hitCount,
    callerChain: getCallerChain(node.id),
  }))
  .sort((a, b) => b.selfTime - a.selfTime)
  .slice(0, topN);

console.log('='.repeat(100));
console.log(`Performance Hotspots ${filterPattern ? `(filtered by: ${filterPattern})` : ''}`);
console.log('='.repeat(100));
console.log(`\nTotal Active CPU Time: ${totalActive} samples\n`);

hotspots.forEach((item, idx) => {
  const { node, selfTime, callerChain } = item;
  const cf = node.callFrame;
  const pct = ((selfTime / totalActive) * 100).toFixed(2);

  let location = cf.url || '(native)';
  if (location.includes('node_modules')) {
    const match = location.match(/node_modules\/_?([^@][^/]*|@[^/]+\/[^/]+)\/(.+)/);
    if (match) {
      location = `${match[1]}/${match[2]}`;
    }
  } else if (!location.includes('node:') && location) {
    const parts = location.split('/');
    location = parts.slice(-3).join('/');
  }

  console.log(`\n--- Hotspot #${idx + 1} ---`);
  console.log(`Function: ${cf.functionName || '(anonymous)'}`);
  console.log(`Self Time: ${selfTime} samples (${pct}%)`);
  console.log(`Location: ${location}:${cf.lineNumber}`);

  if (callerChain.length > 0) {
    console.log('Call Stack (bottom-up):');
    callerChain.forEach((caller, i) => {
      console.log(`  ${i + 1}. ${caller.name} [${caller.location}]`);
    });
  }
});

console.log('\n' + '='.repeat(100));
