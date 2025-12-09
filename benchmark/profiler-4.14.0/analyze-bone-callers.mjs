#!/usr/bin/env node

/**
 * Analyze what cnpmcore code triggers Bone constructor calls
 * The Bone constructor is the #1 CPU consumer (1,574 samples)
 */

import fs from 'node:fs';
import path from 'node:path';

const PROFILE_PATH = process.argv[2] || path.join(
  process.env.HOME,
  'Downloads/cnpmcore/4.14.0/registry-npmmirror-x-cpuprofile-870954-20251209-0.cpuprofile'
);

const OUTPUT_DIR = path.dirname(new URL(import.meta.url).pathname);

const content = fs.readFileSync(PROFILE_PATH, 'utf-8');
const profile = JSON.parse(content);

const nodeMap = new Map(profile.nodes.map(n => [n.id, n]));

// Helper functions
function getNodeName(node) {
  const fn = node.callFrame.functionName || '(anonymous)';
  const url = node.callFrame.url || '';
  const basename = url ? url.split('/').pop().replace('.js', '') : '';
  const line = node.callFrame.lineNumber;
  return basename ? `${fn}@${basename}:${line}` : fn;
}

function isCnpmcore(node) {
  const url = node.callFrame.url || '';
  return url.includes('/app/') && !url.includes('node_modules');
}

function isLeoric(node) {
  const url = node.callFrame.url || '';
  return url.includes('leoric');
}

function isBoneConstructor(node) {
  return node.callFrame.functionName === 'Bone' &&
         (node.callFrame.url || '').includes('bone.js');
}

// Find all paths that lead to Bone constructor
const bonePaths = [];

function findBonePaths(nodeId, path = [], visited = new Set()) {
  if (visited.has(nodeId)) return;
  visited.add(nodeId);

  const node = nodeMap.get(nodeId);
  if (!node) return;

  const currentPath = [...path, node];

  if (isBoneConstructor(node) && node.hitCount > 0) {
    bonePaths.push({
      path: currentPath,
      hits: node.hitCount
    });
    return; // Don't go deeper
  }

  if (node.children) {
    for (const childId of node.children) {
      findBonePaths(childId, currentPath, new Set(visited));
    }
  }
}

console.log('Finding all paths to Bone constructor...\n');
findBonePaths(1);

console.log(`Found ${bonePaths.length} paths to Bone constructor\n`);

// Aggregate by cnpmcore entry point
const cnpmcoreEntries = new Map();

for (const { path, hits } of bonePaths) {
  // Find all cnpmcore functions in the path
  const cnpmcoreFunctions = path.filter(isCnpmcore);

  if (cnpmcoreFunctions.length > 0) {
    // Use the deepest cnpmcore function as the key
    const entry = cnpmcoreFunctions[cnpmcoreFunctions.length - 1];
    const key = getNodeName(entry);

    if (!cnpmcoreEntries.has(key)) {
      cnpmcoreEntries.set(key, {
        node: entry,
        totalHits: 0,
        paths: []
      });
    }

    cnpmcoreEntries.get(key).totalHits += hits;
    cnpmcoreEntries.get(key).paths.push({ path, hits });
  }
}

// Sort by total hits
const sorted = [...cnpmcoreEntries.entries()]
  .sort((a, b) => b[1].totalHits - a[1].totalHits);

console.log('=== cnpmcore Functions that Trigger Bone Constructor ===\n');
console.log('| cnpmcore Function | Total Bone Hits | Path Count |');
console.log('|-------------------|-----------------|------------|');

for (const [key, data] of sorted) {
  console.log(`| ${key} | ${data.totalHits} | ${data.paths.length} |`);
}

// Show detailed paths for top entries
console.log('\n\n=== Detailed Call Chains to Bone Constructor ===\n');

for (const [key, data] of sorted.slice(0, 5)) {
  console.log(`### ${key} (${data.totalHits} Bone hits)\n`);

  // Show the most impactful path
  const topPath = data.paths.sort((a, b) => b.hits - a.hits)[0];
  console.log('Most impactful path:');
  console.log('```');

  // Show simplified path
  for (const node of topPath.path) {
    const name = getNodeName(node);
    if (isCnpmcore(node)) {
      console.log(`[APP] ${name}`);
    } else if (isLeoric(node)) {
      console.log(`[ORM] ${name}`);
    }
  }
  console.log('```\n');
}

// Find the root cause - what ORM operations trigger Bone
console.log('\n=== ORM Operations Triggering Bone Constructor ===\n');

const ormOperations = new Map();

for (const { path, hits } of bonePaths) {
  // Find the first leoric function in the path (the entry point to ORM)
  for (let i = 0; i < path.length; i++) {
    const node = path[i];
    if (isLeoric(node)) {
      const name = getNodeName(node);
      if (!ormOperations.has(name)) {
        ormOperations.set(name, { totalHits: 0, count: 0 });
      }
      ormOperations.get(name).totalHits += hits;
      ormOperations.get(name).count++;
      break;
    }
  }
}

const sortedOps = [...ormOperations.entries()]
  .sort((a, b) => b[1].totalHits - a[1].totalHits);

console.log('| ORM Entry Point | Total Bone Hits | Path Count |');
console.log('|-----------------|-----------------|------------|');

for (const [name, data] of sortedOps.slice(0, 10)) {
  console.log(`| ${name} | ${data.totalHits} | ${data.count} |`);
}

// Generate a visual diagram
let diagram = `
================================================================================
              BONE CONSTRUCTOR CALL DIAGRAM
            (1,574 CPU samples - #1 hotspot)
================================================================================

The Bone constructor is called when ORM instantiates model objects from
database query results. Here's how cnpmcore code triggers these calls:

`;

for (const [key, data] of sorted.slice(0, 10)) {
  if (data.totalHits === 0) continue;

  diagram += `
┌─────────────────────────────────────────────────────────────────────────────┐
│ [APP] ${key.padEnd(69)} │
│ Bone hits: ${String(data.totalHits).padEnd(62)} │
└─────────────────────────────────────────────────────────────────────────────┘
`;

  // Show the chain
  const topPath = data.paths[0];
  let prevCategory = '';

  for (let i = 0; i < topPath.path.length; i++) {
    const node = topPath.path[i];
    const name = getNodeName(node);

    if (isLeoric(node)) {
      if (prevCategory !== 'leoric') {
        diagram += `    │\n    ▼ ORM Layer\n`;
      }
      if (isBoneConstructor(node)) {
        diagram += `    └──→ ★ ${name} (${node.hitCount} samples) ★\n`;
      } else {
        diagram += `    ├──→ ${name}\n`;
      }
      prevCategory = 'leoric';
    }
  }
  diagram += '\n';
}

diagram += `
================================================================================
                           ANALYSIS
================================================================================

The Bone constructor overhead comes from:
1. Every database row returned creates a new Bone instance
2. The instantiate() function in bone.js:1282 is the direct caller
3. ContextModelClass in SingletonModelObject.js wraps the Bone constructor

Key cnpmcore operations that trigger heavy Bone instantiation:
`;

let rank = 1;
for (const [key, data] of sorted.slice(0, 5)) {
  if (data.totalHits > 0) {
    diagram += `${rank}. ${key.split('@')[0]} - ${data.totalHits} Bone constructor calls\n`;
    rank++;
  }
}

diagram += `
================================================================================
`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'bone-callers.txt'), diagram);
console.log('\nDiagram written to bone-callers.txt');

// Generate markdown report
let md = `# Bone Constructor Call Analysis

## Overview

The \`Bone\` constructor in Leoric ORM is the **#1 CPU consumer** with 1,574 samples (4.65% of active CPU time). This analysis shows which cnpmcore application code triggers these Bone constructor calls.

## How Bone Constructor Gets Called

\`\`\`
cnpmcore Application Code
    │
    ▼
Repository.findXxx() / Repository.listXxx()
    │
    ▼
Leoric Model.findOne() / Model.find()
    │
    ▼
Spell.ignite() → Collection.dispatch() → Bone.instantiate()
    │
    ▼
ContextModelClass (SingletonModelObject.js)
    │
    ▼
★ Bone constructor (bone.js:150) ★
\`\`\`

## cnpmcore Functions Triggering Bone Constructor

| Function | File | Bone Hits | Impact |
|----------|------|-----------|--------|
`;

for (const [key, data] of sorted.slice(0, 15)) {
  const [fn, location] = key.split('@');
  if (data.totalHits > 0) {
    md += `| \`${fn}\` | ${location || 'N/A'} | ${data.totalHits} | ${((data.totalHits / 1574) * 100).toFixed(1)}% |\n`;
  }
}

md += `

## Detailed Call Chains

`;

for (const [key, data] of sorted.slice(0, 5)) {
  if (data.totalHits === 0) continue;

  md += `### ${key.split('@')[0]} (${data.totalHits} Bone samples)

\`\`\`
`;

  const topPath = data.paths[0];
  for (const node of topPath.path) {
    if (isCnpmcore(node)) {
      md += `[APP] ${getNodeName(node)}\n`;
    } else if (isLeoric(node)) {
      if (isBoneConstructor(node)) {
        md += `[ORM] ★ ${getNodeName(node)} ★\n`;
      } else {
        md += `[ORM] ${getNodeName(node)}\n`;
      }
    }
  }
  md += `\`\`\`

`;
}

md += `## ORM Operations That Create Bone Instances

| ORM Function | Bone Hits | Notes |
|--------------|-----------|-------|
`;

for (const [name, data] of sortedOps.slice(0, 8)) {
  md += `| \`${name.split('@')[0]}\` | ${data.totalHits} | Entry point |\n`;
}

md += `

## Optimization Suggestions

### 1. Batch Database Queries

Instead of multiple \`findOne()\` calls, use \`find()\` with batch conditions:

\`\`\`javascript
// Before: N+1 queries
for (const id of ids) {
  await Model.findOne({ id });  // Each creates Bone instance
}

// After: Single query
const results = await Model.find({ id: ids });  // Fewer Bone instances per query
\`\`\`

### 2. Use Raw Queries for Read-Only Operations

When you don't need model methods:

\`\`\`javascript
// Before: Creates Bone instances
const results = await Model.find(conditions);

// After: Returns plain objects (no Bone overhead)
const results = await Model.find(conditions).raw();
\`\`\`

### 3. Select Only Needed Columns

\`\`\`javascript
// Before: Fetches all columns
await Model.findOne({ id });

// After: Fetches only needed columns
await Model.findOne({ id }).select('id', 'name');
\`\`\`

### 4. Consider Caching for Frequently Accessed Data

For data that's read frequently but rarely changes, implement caching to avoid repeated database queries and Bone instantiation.

## Conclusion

The Bone constructor overhead is primarily triggered by:
1. **Download counter operations** (savePackageVersionCounters → plus)
2. **Package lookups** (findPackageId, findPackage)
3. **Entity conversion** (convertModelToEntity, fillPackageVersionEntityData)

These are fundamental operations for an NPM registry, so the optimization focus should be on:
- Reducing query frequency through batching
- Using raw queries where model methods aren't needed
- Caching frequently accessed data
`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'BONE-CALLERS-REPORT.md'), md);
console.log('Markdown report written to BONE-CALLERS-REPORT.md');
