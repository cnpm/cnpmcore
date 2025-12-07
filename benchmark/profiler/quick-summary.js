#!/usr/bin/env node
/**
 * Quick CPU profile summary - outputs a concise one-page summary
 *
 * Usage: node quick-summary.js <profile.cpuprofile>
 */

import fs from 'node:fs';

const profilePath = process.argv[2];

if (!profilePath) {
  console.error('Usage: node quick-summary.js <profile.cpuprofile>');
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

// Calculate statistics
const totalHits = profile.nodes.reduce((sum, n) => sum + n.hitCount, 0);
const excluded = ['(idle)', '(root)', '(program)', '(garbage collector)'];

const idleNode = profile.nodes.find((n) => n.callFrame.functionName === '(idle)');
const programNode = profile.nodes.find((n) => n.callFrame.functionName === '(program)');
const gcNode = profile.nodes.find((n) => n.callFrame.functionName === '(garbage collector)');

const idleHits = idleNode ? idleNode.hitCount : 0;
const programHits = programNode ? programNode.hitCount : 0;
const gcHits = gcNode ? gcNode.hitCount : 0;
const activeHits = totalHits - idleHits - programHits - gcHits;

const duration = (profile.endTime - profile.startTime) / 1000000;
const fileName = profilePath.split('/').pop();

console.log('');
console.log('┌' + '─'.repeat(78) + '┐');
console.log('│' + ` CPU Profile Quick Summary: ${fileName}`.padEnd(78) + '│');
console.log('├' + '─'.repeat(78) + '┤');

console.log('│' + ` Duration: ${duration.toFixed(2)}s | Samples: ${totalHits} | Active: ${activeHits} (${((activeHits / totalHits) * 100).toFixed(1)}%)`.padEnd(78) + '│');
console.log('│' + ` Idle: ${((idleHits / totalHits) * 100).toFixed(1)}% | GC: ${((gcHits / totalHits) * 100).toFixed(1)}% | Program: ${((programHits / totalHits) * 100).toFixed(1)}%`.padEnd(78) + '│');
console.log('├' + '─'.repeat(78) + '┤');

// Top 5 hotspots
console.log('│' + ' TOP 5 HOTSPOTS:'.padEnd(78) + '│');
console.log('├' + '─'.repeat(78) + '┤');

const topFunctions = profile.nodes
  .filter((n) => n.hitCount > 0 && excluded.indexOf(n.callFrame.functionName) === -1)
  .sort((a, b) => b.hitCount - a.hitCount)
  .slice(0, 5);

topFunctions.forEach((node, idx) => {
  const pct = ((node.hitCount / activeHits) * 100).toFixed(1);
  const name = (node.callFrame.functionName || '(anonymous)').substring(0, 30);
  let location = node.callFrame.url || '(native)';
  if (location.includes('node_modules')) {
    const match = location.match(/node_modules\/_?([^@][^/]*|@[^/]+\/[^/]+)/);
    location = match ? match[1] : location.split('/').slice(-2).join('/');
  } else if (location && !location.includes('node:')) {
    location = location.split('/').slice(-2).join('/');
  }
  location = location.substring(0, 35);

  console.log('│' + ` ${idx + 1}. ${name.padEnd(30)} ${pct.padStart(5)}%  ${location}`.padEnd(78) + '│');
});

console.log('├' + '─'.repeat(78) + '┤');

// Top 5 modules
console.log('│' + ' TOP 5 MODULES BY CPU:'.padEnd(78) + '│');
console.log('├' + '─'.repeat(78) + '┤');

const moduleStats = new Map();
profile.nodes.forEach((node) => {
  if (node.hitCount === 0) return;
  if (excluded.indexOf(node.callFrame.functionName) !== -1) return;

  let url = node.callFrame.url || '(native)';
  if (url.includes('node_modules')) {
    const match = url.match(/node_modules\/_?([^@][^/]*|@[^/]+\/[^/]+)/);
    if (match) {
      url = match[1];
    }
  } else if (url.includes('node:')) {
    url = 'node:* (core)';
  } else if (url) {
    url = 'app (application)';
  }

  const current = moduleStats.get(url) || 0;
  moduleStats.set(url, current + node.hitCount);
});

const topModules = Array.from(moduleStats.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5);

topModules.forEach(([module, hits], idx) => {
  const pct = ((hits / activeHits) * 100).toFixed(1);
  const name = module.substring(0, 45);
  console.log('│' + ` ${idx + 1}. ${name.padEnd(45)} ${hits.toString().padStart(6)} (${pct.padStart(5)}%)`.padEnd(78) + '│');
});

console.log('└' + '─'.repeat(78) + '┘');
console.log('');
