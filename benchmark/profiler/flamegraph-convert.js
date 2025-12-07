#!/usr/bin/env node
/**
 * Convert xprofiler/V8 CPU profile to Brendan Gregg's folded stack format
 * for generating flame graphs.
 *
 * Usage:
 *   node flamegraph-convert.js <profile.cpuprofile> > stacks.txt
 *   cat stacks.txt | flamegraph.pl > flamegraph.svg
 *
 * Or use speedscope.app to view the .cpuprofile directly
 */

import fs from 'node:fs';

const profilePath = process.argv[2];

if (!profilePath) {
  console.error('Usage: node flamegraph-convert.js <profile.cpuprofile>');
  process.exit(1);
}

if (!fs.existsSync(profilePath)) {
  console.error('Profile file not found:', profilePath);
  process.exit(1);
}

const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));

// Build node map
const nodeMap = new Map();
profile.nodes.forEach(node => nodeMap.set(node.id, node));

// Build parent map for reverse traversal
const parentMap = new Map();
profile.nodes.forEach(node => {
  if (node.children) {
    node.children.forEach(childId => {
      parentMap.set(childId, node.id);
    });
  }
});

// Get stack for a node (bottom-up)
function getStack(nodeId) {
  const stack = [];
  let currentId = nodeId;

  while (currentId) {
    const node = nodeMap.get(currentId);
    if (!node) break;

    const cf = node.callFrame;
    let name = cf.functionName || '(anonymous)';

    // Add file info for better readability
    if (cf.url) {
      const file = cf.url.split('/').slice(-1)[0];
      name = `${name} (${file}:${cf.lineNumber})`;
    }

    stack.unshift(name);
    currentId = parentMap.get(currentId);
  }

  return stack;
}

// Output folded stacks
const stackCounts = new Map();

profile.nodes.forEach(node => {
  if (node.hitCount > 0) {
    const stack = getStack(node.id);
    const stackStr = stack.join(';');
    const current = stackCounts.get(stackStr) || 0;
    stackCounts.set(stackStr, current + node.hitCount);
  }
});

// Output in folded format
stackCounts.forEach((count, stack) => {
  console.log(`${stack} ${count}`);
});
