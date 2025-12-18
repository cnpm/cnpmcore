#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const profilePath = path.join(os.homedir(), 'Downloads/cnpmcore/4.16.2/r.cnpmjs.org-x-cpuprofile-325985-20251218-0');
const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));

// Build parent map
const parentMap = new Map();
profile.nodes.forEach(node => {
  if (node.children) {
    node.children.forEach(childId => {
      if (!parentMap.has(childId)) {
        parentMap.set(childId, []);
      }
      parentMap.get(childId).push(node.id);
    });
  }
});

const nodeMap = new Map();
profile.nodes.forEach(n => nodeMap.set(n.id, n));

// Find all crc32 nodes and their immediate parents
const crc32Nodes = profile.nodes.filter(n => n.callFrame.functionName === 'crc32' && n.hitCount > 0);

console.log('=== CRC32 Immediate Parents ===');
const parentStats = new Map();

crc32Nodes.forEach(crcNode => {
  const parents = parentMap.get(crcNode.id) || [];
  parents.forEach(parentId => {
    const parent = nodeMap.get(parentId);
    if (parent) {
      const url = parent.callFrame.url || '(native)';
      const shortUrl = url.includes('node_modules')
        ? url.split('node_modules/').pop().split('/').slice(0, 2).join('/')
        : url.includes('application/')
          ? url.split('application/').pop()
          : url;
      const key = `${parent.callFrame.functionName}@${shortUrl}:${parent.callFrame.lineNumber}`;
      const current = parentStats.get(key) || { hits: 0, count: 0 };
      current.hits += crcNode.hitCount;
      current.count++;
      parentStats.set(key, current);
    }
  });
});

// Sort by hits
const sorted = Array.from(parentStats.entries()).sort((a, b) => b[1].hits - a[1].hits);

console.log('\nImmediate callers of crc32():');
sorted.forEach(([key, stats]) => {
  console.log(`  ${stats.hits} hits (${stats.count}x): ${key}`);
});

// Now let's also check what's calling those functions
console.log('\n=== Full Call Chain Analysis ===');

// For each crc32 node, get the full path
crc32Nodes.sort((a, b) => b.hitCount - a.hitCount).slice(0, 5).forEach((crcNode, idx) => {
  console.log(`\n--- CRC32 #${idx + 1} (${crcNode.hitCount} hits) ---`);

  let currentId = crcNode.id;
  let depth = 0;

  while (currentId && depth < 15) {
    const node = nodeMap.get(currentId);
    if (!node) break;

    const cf = node.callFrame;
    const url = cf.url || '(native)';
    let shortUrl = url;

    if (url.includes('node_modules')) {
      shortUrl = url.split('node_modules/').pop();
      // Get package name
      const parts = shortUrl.split('/');
      if (parts[0].startsWith('@') || parts[0].startsWith('_')) {
        shortUrl = parts.slice(0, 2).join('/') + '/' + parts.slice(2).join('/').split('/').slice(-2).join('/');
      } else {
        shortUrl = parts[0] + '/' + parts.slice(1).join('/').split('/').slice(-2).join('/');
      }
    } else if (url.includes('application/')) {
      shortUrl = 'app/' + url.split('application/').pop();
    }

    const indent = '  '.repeat(depth);
    console.log(`${indent}${cf.functionName || '(anonymous)'} [${shortUrl}:${cf.lineNumber}]`);

    const parents = parentMap.get(currentId);
    currentId = parents && parents[0];
    depth++;
  }
});
