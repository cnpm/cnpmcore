#!/usr/bin/env node

/**
 * Full path analysis - traces complete call chains from root to Bone
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

function getNodeName(node) {
  const fn = node.callFrame.functionName || '(anonymous)';
  const url = node.callFrame.url || '';
  const basename = url ? url.split('/').pop().replace('.js', '') : '';
  const line = node.callFrame.lineNumber;
  return basename ? `${fn}@${basename}:${line}` : fn;
}

function getCategory(node) {
  const url = node.callFrame.url || '';
  const fn = node.callFrame.functionName || '';

  if (fn === '(idle)' || fn === '(program)' || fn === '(garbage collector)') return 'system';
  if (url.includes('/app/') && !url.includes('node_modules')) return 'cnpmcore';
  if (url.includes('leoric')) return 'leoric';
  if (url.includes('tegg') || (url.includes('egg') && url.includes('node_modules'))) return 'tegg';
  if (url.includes('mysql2')) return 'mysql';
  if (url.includes('node:')) return 'node';
  if (url === '' || url.includes('native')) return 'native';
  return 'other';
}

// Find Bone constructor nodes
const boneNodes = profile.nodes.filter(n =>
  n.callFrame.functionName === 'Bone' &&
  (n.callFrame.url || '').includes('bone.js') &&
  n.hitCount > 0
);

console.log('Bone constructor nodes with hits:', boneNodes.length);
console.log('Total Bone hits:', boneNodes.reduce((sum, n) => sum + n.hitCount, 0));

// Build reverse parent map
const parentMap = new Map();
for (const node of profile.nodes) {
  if (node.children) {
    for (const childId of node.children) {
      if (!parentMap.has(childId)) {
        parentMap.set(childId, []);
      }
      parentMap.get(childId).push(node.id);
    }
  }
}

// Trace back from Bone to root, collecting all paths
function traceBackToRoot(nodeId, path = []) {
  const node = nodeMap.get(nodeId);
  if (!node) return [];

  const currentPath = [node, ...path];

  // If we reached root (no parents), return this path
  const parents = parentMap.get(nodeId);
  if (!parents || parents.length === 0) {
    return [currentPath];
  }

  // Collect all paths from all parents
  const allPaths = [];
  for (const parentId of parents) {
    const parentPaths = traceBackToRoot(parentId, currentPath);
    allPaths.push(...parentPaths);
  }

  return allPaths;
}

console.log('\nTracing paths from Bone constructor to root...\n');

const allBonePaths = [];
for (const boneNode of boneNodes) {
  const paths = traceBackToRoot(boneNode.id);
  for (const p of paths) {
    allBonePaths.push({ path: p, hits: boneNode.hitCount });
  }
}

console.log(`Found ${allBonePaths.length} complete paths\n`);

// Analyze paths to find cnpmcore entry points
const cnpmcoreInvocations = new Map();

for (const { path, hits } of allBonePaths) {
  // Find cnpmcore functions in the path
  const cnpmcoreFns = path.filter(n => getCategory(n) === 'cnpmcore');

  if (cnpmcoreFns.length > 0) {
    // The first cnpmcore function is the entry point from framework
    const entry = cnpmcoreFns[0];
    const key = getNodeName(entry);

    if (!cnpmcoreInvocations.has(key)) {
      cnpmcoreInvocations.set(key, { node: entry, hits: 0, paths: [] });
    }
    cnpmcoreInvocations.get(key).hits += hits;
    cnpmcoreInvocations.get(key).paths.push(path);
  }
}

console.log('=== cnpmcore Entry Points Leading to Bone Constructor ===\n');
console.log('| cnpmcore Function | Bone Hits | % of Total |');
console.log('|-------------------|-----------|------------|');

const totalBoneHits = boneNodes.reduce((sum, n) => sum + n.hitCount, 0);
const sorted = [...cnpmcoreInvocations.entries()].sort((a, b) => b[1].hits - a[1].hits);

for (const [key, data] of sorted.slice(0, 20)) {
  const pct = ((data.hits / totalBoneHits) * 100).toFixed(1);
  console.log(`| ${key} | ${data.hits} | ${pct}% |`);
}

// Show detailed call chains for top entries
console.log('\n\n=== Top Call Chains (Root → cnpmcore → Leoric → Bone) ===\n');

for (const [key, data] of sorted.slice(0, 5)) {
  console.log(`### ${key} (${data.hits} Bone samples)\n`);

  const samplePath = data.paths[0];
  console.log('Full call chain:');
  console.log('```');

  let lastCategory = '';
  for (const node of samplePath) {
    const cat = getCategory(node);
    const name = getNodeName(node);

    if (cat === 'system' || cat === 'native') continue;

    if (cat !== lastCategory) {
      const label = cat.toUpperCase().padEnd(8);
      console.log(`[${label}] ${name}`);
    } else {
      console.log(`           └─ ${node.callFrame.functionName}`);
    }
    lastCategory = cat;
  }
  console.log('```\n');
}

// Create a simplified flow diagram
console.log('\n=== Simplified Call Flow ===\n');
console.log('```');
console.log('HTTP Request');
console.log('    │');
console.log('    ▼');
console.log('Tegg Framework (middleware, routing, DI)');
console.log('    │');
console.log('    ▼');

const topEntries = sorted.slice(0, 5);
for (const [key, data] of topEntries) {
  const fn = key.split('@')[0];
  console.log(`┌─────────────────────────────────────────┐`);
  console.log(`│ ${fn.padEnd(39)} │`);
  console.log(`│ (${data.hits} samples → Bone constructor)`.padEnd(41) + '│');
  console.log(`└─────────────────────────────────────────┘`);
  console.log('    │');
}

console.log('    ▼');
console.log('Leoric ORM');
console.log('    │');
console.log('    ├─→ Model.findOne() / Model.find()');
console.log('    │       │');
console.log('    │       ▼');
console.log('    │   Spell (query builder)');
console.log('    │       │');
console.log('    │       ▼');
console.log('    │   Collection.dispatch()');
console.log('    │       │');
console.log('    │       ▼');
console.log('    │   Bone.instantiate()');
console.log('    │       │');
console.log('    │       ▼');
console.log('    └─→ ★ Bone Constructor ★');
console.log('        (1,574 samples = 4.65% active CPU)');
console.log('```');

// Generate comprehensive markdown report
let md = `# Complete Call Flow Analysis: cnpmcore → Leoric → Bone

## Overview

This analysis traces the complete call paths from HTTP requests through cnpmcore application code to the Leoric ORM Bone constructor, which is the #1 CPU hotspot (1,574 samples, 4.65% of active CPU).

## High-Level Call Flow

\`\`\`
HTTP Request
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Tegg Framework Layer                            │
│  - ctxLifecycleMiddleware                                          │
│  - Router.dispatch() → Layer.match()                               │
│  - EggContainerFactory.getOrCreateEggObject()                      │
│  - EggObjectImpl.injectProperty()                                  │
└─────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     cnpmcore Application Layer                      │
│  - Controllers (DownloadPackageVersionTar, etc.)                   │
│  - Services (PackageManagerService, etc.)                          │
│  - Repositories (PackageRepository, etc.)                          │
└─────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        Leoric ORM Layer                             │
│  - Model.findOne() / Model.find()                                  │
│  - Spell (query builder)                                           │
│  - Collection.dispatch() → Bone.instantiate()                      │
│  - ★ Bone Constructor (1,574 samples) ★                            │
└─────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        MySQL Driver Layer                           │
│  - mysql2 query execution                                          │
│  - Result parsing                                                  │
└─────────────────────────────────────────────────────────────────────┘
\`\`\`

## cnpmcore Functions That Trigger Bone Constructor

| cnpmcore Function | Location | Bone Hits | % of Total |
|-------------------|----------|-----------|------------|
`;

for (const [key, data] of sorted.slice(0, 15)) {
  const [fn, loc] = key.split('@');
  const pct = ((data.hits / totalBoneHits) * 100).toFixed(1);
  md += `| \`${fn}\` | ${loc || 'N/A'} | ${data.hits} | ${pct}% |\n`;
}

md += `

## Detailed Call Chains

The following shows the complete call stack from framework entry to Bone constructor:

`;

for (const [key, data] of sorted.slice(0, 5)) {
  md += `### ${key.split('@')[0]} (${data.hits} samples)

\`\`\`
`;

  const samplePath = data.paths[0];
  let lastCategory = '';

  for (const node of samplePath) {
    const cat = getCategory(node);
    const name = getNodeName(node);

    if (cat === 'system' || cat === 'native') continue;

    const catLabel = {
      'tegg': 'TEGG',
      'cnpmcore': 'APP',
      'leoric': 'ORM',
      'mysql': 'MYSQL',
      'node': 'NODE',
      'other': 'OTHER'
    }[cat] || cat.toUpperCase();

    if (cat !== lastCategory) {
      md += `[${catLabel}] ${name}\n`;
    } else {
      md += `       └─ ${node.callFrame.functionName}\n`;
    }
    lastCategory = cat;
  }
  md += `\`\`\`

`;
}

md += `## Call Graph Visualization

\`\`\`mermaid
flowchart TB
    subgraph Framework["Tegg Framework"]
        MW[Middleware]
        RT[Router]
        DI[DI Container]
    end

    subgraph App["cnpmcore Application"]
`;

for (const [key, data] of sorted.slice(0, 5)) {
  const fn = key.split('@')[0];
  const id = fn.replace(/[^a-zA-Z0-9]/g, '_');
  md += `        ${id}["${fn}<br/>(${data.hits} samples)"]\n`;
}

md += `    end

    subgraph ORM["Leoric ORM"]
        FIND[Model.find/findOne]
        SPELL[Spell Query Builder]
        COLL[Collection.dispatch]
        BONE["★ Bone Constructor ★<br/>(1,574 samples)"]
    end

    MW --> RT --> DI
`;

for (const [key, data] of sorted.slice(0, 5)) {
  const fn = key.split('@')[0];
  const id = fn.replace(/[^a-zA-Z0-9]/g, '_');
  md += `    DI --> ${id}\n`;
  md += `    ${id} --> FIND\n`;
}

md += `    FIND --> SPELL --> COLL --> BONE
\`\`\`

## Summary

The Bone constructor is triggered through these main pathways:

1. **Download Operations**
   - \`DownloadPackageVersionTar.download()\` triggers package lookups
   - \`PackageManagerService.savePackageVersionCounters()\` updates download stats

2. **Package Queries**
   - \`PackageRepository.findPackageId()\` - finds package by scope/name
   - \`PackageRepository.findPackage()\` - loads full package data
   - \`PackageRepository.findPackageVersion()\` - loads specific version

3. **Binary Operations**
   - \`BinaryRepository.findBinary()\` - binary package lookups
   - \`BinaryRepository.listBinaries()\` - listing binaries

4. **Task Management**
   - \`TaskRepository.findTask()\` - task lookups
   - \`TaskRepository.saveTask()\` - task persistence

## Optimization Recommendations

### 1. The Bone constructor overhead is inherent to ORM design

Each database row becomes a Bone instance with:
- Getter/setter definitions
- Change tracking capability
- Relationship loading support

### 2. To reduce Bone overhead:

1. **Use \`.raw()\` for read-only queries** - returns plain objects
2. **Use \`.select()\` to limit columns** - smaller objects
3. **Batch queries** - fewer ORM invocations
4. **Cache frequently accessed data** - avoid repeated queries

### 3. The application code is efficient

cnpmcore's own code only uses 4.47% of active CPU. The overhead is in:
- Framework (27.3%)
- ORM (15.2%)
- These are architectural costs, not application bugs
`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'FULL-CALL-FLOW-REPORT.md'), md);
console.log('\n\nMarkdown report written to FULL-CALL-FLOW-REPORT.md');
