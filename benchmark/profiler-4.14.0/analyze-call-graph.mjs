#!/usr/bin/env node

/**
 * Call Graph Analysis - Application Code to Leoric ORM
 * Generates a call relationship diagram between cnpmcore app code and Leoric hotspots
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

// Helper to categorize a node
function categorize(node) {
  const url = node.callFrame.url || '';
  const fn = node.callFrame.functionName || '';

  if (url.includes('/app/') && !url.includes('node_modules')) {
    return 'cnpmcore';
  } else if (url.includes('leoric')) {
    return 'leoric';
  } else if (url.includes('tegg') || url.includes('egg')) {
    return 'tegg';
  } else if (url.includes('mysql2')) {
    return 'mysql2';
  } else if (url.includes('node:') || url === '') {
    return 'node/native';
  } else {
    return 'other';
  }
}

// Helper to get a readable name
function getNodeName(node) {
  const fn = node.callFrame.functionName || '(anonymous)';
  const url = node.callFrame.url || '';
  const basename = url ? url.split('/').pop().replace('.js', '') : '';
  const line = node.callFrame.lineNumber;

  if (basename) {
    return `${fn}@${basename}:${line}`;
  }
  return fn;
}

// Helper to get short name
function getShortName(node) {
  const fn = node.callFrame.functionName || '(anonymous)';
  const url = node.callFrame.url || '';
  const basename = url ? url.split('/').pop().replace('.js', '') : '';
  return basename ? `${fn}` : fn;
}

// Find all paths from cnpmcore code to leoric
const callPaths = [];

function findPathsToLeoric(nodeId, path = [], visited = new Set()) {
  if (visited.has(nodeId)) return;
  visited.add(nodeId);

  const node = nodeMap.get(nodeId);
  if (!node) return;

  const category = categorize(node);
  const currentPath = [...path, { node, category }];

  // If we hit leoric, record the path
  if (category === 'leoric') {
    // Only record if path starts from cnpmcore or has cnpmcore in it
    const hasCnpmcore = currentPath.some(p => p.category === 'cnpmcore');
    if (hasCnpmcore) {
      callPaths.push(currentPath);
    }
    return; // Don't go deeper into leoric
  }

  if (node.children) {
    for (const childId of node.children) {
      findPathsToLeoric(childId, currentPath, new Set(visited));
    }
  }
}

console.log('Analyzing call paths from cnpmcore to Leoric...\n');
findPathsToLeoric(1);

console.log(`Found ${callPaths.length} paths from cnpmcore to Leoric\n`);

// Aggregate by entry points (cnpmcore functions that lead to leoric)
const entryPoints = new Map();

for (const path of callPaths) {
  // Find the last cnpmcore function before entering other layers
  let lastCnpmcore = null;
  let firstLeoric = null;
  let intermediates = [];

  for (let i = 0; i < path.length; i++) {
    const { node, category } = path[i];
    if (category === 'cnpmcore') {
      lastCnpmcore = node;
      intermediates = [];
    } else if (category === 'leoric' && lastCnpmcore) {
      firstLeoric = node;
      break;
    } else if (lastCnpmcore) {
      intermediates.push(path[i]);
    }
  }

  if (lastCnpmcore && firstLeoric) {
    const key = getNodeName(lastCnpmcore);
    if (!entryPoints.has(key)) {
      entryPoints.set(key, {
        node: lastCnpmcore,
        leoricTargets: new Map(),
        totalHits: 0,
        paths: []
      });
    }

    const entry = entryPoints.get(key);
    const leoricKey = getNodeName(firstLeoric);

    if (!entry.leoricTargets.has(leoricKey)) {
      entry.leoricTargets.set(leoricKey, {
        node: firstLeoric,
        count: 0,
        hitCount: firstLeoric.hitCount || 0
      });
    }

    entry.leoricTargets.get(leoricKey).count++;
    entry.totalHits += firstLeoric.hitCount || 0;
    entry.paths.push({ intermediates, firstLeoric });
  }
}

// Sort by total hits
const sortedEntries = [...entryPoints.entries()]
  .sort((a, b) => b[1].totalHits - a[1].totalHits);

// Generate Mermaid diagram
let mermaid = `flowchart LR
    subgraph cnpmcore["cnpmcore Application"]
`;

const cnpmcoreNodes = new Set();
const leoricNodes = new Set();
const edges = new Map();

for (const [key, entry] of sortedEntries.slice(0, 20)) {
  const cnpmId = `app_${key.replace(/[^a-zA-Z0-9]/g, '_')}`;
  cnpmcoreNodes.add({ id: cnpmId, name: getShortName(entry.node), fullName: key });

  for (const [leoricKey, target] of entry.leoricTargets) {
    const leoricId = `orm_${leoricKey.replace(/[^a-zA-Z0-9]/g, '_')}`;
    leoricNodes.add({ id: leoricId, name: getShortName(target.node), fullName: leoricKey, hits: target.hitCount });

    const edgeKey = `${cnpmId}->${leoricId}`;
    if (!edges.has(edgeKey)) {
      edges.set(edgeKey, { from: cnpmId, to: leoricId, count: 0, hits: 0 });
    }
    edges.get(edgeKey).count += target.count;
    edges.get(edgeKey).hits += target.hitCount;
  }
}

// Add cnpmcore nodes to diagram
for (const node of cnpmcoreNodes) {
  mermaid += `        ${node.id}["${node.name}"]\n`;
}

mermaid += `    end

    subgraph leoric["Leoric ORM"]
`;

// Add leoric nodes to diagram
for (const node of leoricNodes) {
  mermaid += `        ${node.id}["${node.name}<br/>(${node.hits} hits)"]\n`;
}

mermaid += `    end

`;

// Add edges
for (const [key, edge] of edges) {
  if (edge.hits > 0) {
    mermaid += `    ${edge.from} -->|"${edge.hits}"| ${edge.to}\n`;
  } else {
    mermaid += `    ${edge.from} --> ${edge.to}\n`;
  }
}

console.log('=== Call Relationship: cnpmcore → Leoric ===\n');

// Print detailed analysis
console.log('Top cnpmcore functions calling Leoric (by CPU impact):\n');
console.log('| cnpmcore Function | Leoric Target | Hits | Path Count |');
console.log('|-------------------|---------------|------|------------|');

for (const [key, entry] of sortedEntries.slice(0, 30)) {
  for (const [leoricKey, target] of [...entry.leoricTargets.entries()].sort((a, b) => b[1].hitCount - a[1].hitCount)) {
    if (target.hitCount > 0) {
      console.log(`| ${getShortName(entry.node)} | ${getShortName(target.node)} | ${target.hitCount} | ${target.count} |`);
    }
  }
}

// Find the most impactful Leoric functions
console.log('\n\n=== Most CPU-intensive Leoric functions called from cnpmcore ===\n');

const leoricFunctions = new Map();

for (const [key, entry] of entryPoints) {
  for (const [leoricKey, target] of entry.leoricTargets) {
    if (!leoricFunctions.has(leoricKey)) {
      leoricFunctions.set(leoricKey, {
        node: target.node,
        totalHits: 0,
        callers: []
      });
    }
    leoricFunctions.get(leoricKey).totalHits += target.hitCount;
    leoricFunctions.get(leoricKey).callers.push({
      caller: key,
      hits: target.hitCount
    });
  }
}

const sortedLeoricFns = [...leoricFunctions.entries()]
  .sort((a, b) => b[1].totalHits - a[1].totalHits);

console.log('| Leoric Function | Total Hits | Top Callers |');
console.log('|-----------------|------------|-------------|');

for (const [key, data] of sortedLeoricFns.slice(0, 15)) {
  const topCallers = data.callers
    .filter(c => c.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 3)
    .map(c => c.caller.split('@')[0])
    .join(', ');
  console.log(`| ${getShortName(data.node)} | ${data.totalHits} | ${topCallers || 'N/A'} |`);
}

// Generate detailed call chain analysis
console.log('\n\n=== Detailed Call Chains (Top 10 by CPU impact) ===\n');

// Collect all complete paths with hits
const completePaths = [];

function collectCompletePaths(nodeId, path = []) {
  const node = nodeMap.get(nodeId);
  if (!node) return;

  const category = categorize(node);
  const currentPath = [...path, { node, category, name: getNodeName(node) }];

  // If this is a leaf with hits in leoric, record the path
  if (category === 'leoric' && node.hitCount > 0) {
    const hasCnpmcore = currentPath.some(p => p.category === 'cnpmcore');
    if (hasCnpmcore) {
      completePaths.push({
        path: currentPath,
        hits: node.hitCount
      });
    }
  }

  if (node.children) {
    for (const childId of node.children) {
      collectCompletePaths(childId, currentPath);
    }
  }
}

collectCompletePaths(1);

// Sort by hits and show top paths
const sortedPaths = completePaths.sort((a, b) => b.hits - a.hits).slice(0, 10);

for (let i = 0; i < sortedPaths.length; i++) {
  const { path, hits } = sortedPaths[i];
  console.log(`### Chain ${i + 1} (${hits} CPU samples)\n`);
  console.log('```');

  // Show simplified path: cnpmcore -> ... -> leoric
  let inCnpmcore = false;
  let lastCategory = '';

  for (const { node, category, name } of path) {
    if (category === 'cnpmcore') {
      inCnpmcore = true;
      console.log(`[APP] ${name}`);
    } else if (inCnpmcore) {
      if (category === 'leoric') {
        console.log(`[ORM] ${name}`);
      } else if (category !== lastCategory) {
        console.log(`  [${category}] ${getShortName(node)}`);
      }
    }
    lastCategory = category;
  }
  console.log('```\n');
}

// Write mermaid diagram to file
fs.writeFileSync(path.join(OUTPUT_DIR, 'call-graph.mmd'), mermaid);
console.log('\nMermaid diagram written to call-graph.mmd');

// Also create a simpler text-based diagram
let textDiagram = `
================================================================================
                    CALL RELATIONSHIP DIAGRAM
                 cnpmcore Application → Leoric ORM
================================================================================

`;

// Group by cnpmcore function
for (const [key, entry] of sortedEntries.slice(0, 15)) {
  if (entry.totalHits === 0) continue;

  textDiagram += `
┌─────────────────────────────────────────────────────────────────────────────┐
│ ${getShortName(entry.node).padEnd(75)} │
│ (${key})
└─────────────────────────────────────────────────────────────────────────────┘
`;

  const targets = [...entry.leoricTargets.entries()]
    .filter(([_, t]) => t.hitCount > 0)
    .sort((a, b) => b[1].hitCount - a[1].hitCount);

  for (const [leoricKey, target] of targets) {
    textDiagram += `    │
    ├──→ [${target.hitCount} hits] ${getShortName(target.node)}
    │    (${leoricKey})
`;
  }
  textDiagram += '\n';
}

fs.writeFileSync(path.join(OUTPUT_DIR, 'call-graph.txt'), textDiagram);
console.log('Text diagram written to call-graph.txt');

// Generate markdown report
let mdReport = `# Call Relationship: cnpmcore → Leoric ORM

## Overview

This report shows how cnpmcore application code calls into Leoric ORM and which paths consume the most CPU time.

## Call Graph (Mermaid)

\`\`\`mermaid
${mermaid}
\`\`\`

## Top cnpmcore → Leoric Call Paths by CPU Impact

| cnpmcore Function | Leoric Function | CPU Samples |
|-------------------|-----------------|-------------|
`;

for (const [key, entry] of sortedEntries.slice(0, 20)) {
  for (const [leoricKey, target] of [...entry.leoricTargets.entries()].sort((a, b) => b[1].hitCount - a[1].hitCount)) {
    if (target.hitCount > 0) {
      mdReport += `| \`${getShortName(entry.node)}\` | \`${getShortName(target.node)}\` | ${target.hitCount} |\n`;
    }
  }
}

mdReport += `

## Most CPU-Intensive Leoric Functions

| Leoric Function | Total CPU Samples | Called From |
|-----------------|-------------------|-------------|
`;

for (const [key, data] of sortedLeoricFns.slice(0, 10)) {
  if (data.totalHits === 0) continue;
  const topCallers = data.callers
    .filter(c => c.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, 3)
    .map(c => `\`${c.caller.split('@')[0]}\``)
    .join(', ');
  mdReport += `| \`${getShortName(data.node)}\` | ${data.totalHits} | ${topCallers || 'N/A'} |\n`;
}

mdReport += `

## Detailed Call Chains

These are the complete call chains from cnpmcore code to Leoric hotspots:

`;

for (let i = 0; i < sortedPaths.length; i++) {
  const { path, hits } = sortedPaths[i];
  mdReport += `### Chain ${i + 1} (${hits} CPU samples)

\`\`\`
`;

  let inCnpmcore = false;
  for (const { node, category, name } of path) {
    if (category === 'cnpmcore') {
      inCnpmcore = true;
      mdReport += `[APP] ${name}\n`;
    } else if (inCnpmcore && category === 'leoric') {
      mdReport += `[ORM] ${name}\n`;
    } else if (inCnpmcore) {
      mdReport += `  └─→ ${getShortName(node)}\n`;
    }
  }
  mdReport += `\`\`\`

`;
}

mdReport += `
## Summary

The main entry points from cnpmcore to Leoric are:

`;

let rank = 1;
for (const [key, entry] of sortedEntries.slice(0, 5)) {
  if (entry.totalHits > 0) {
    mdReport += `${rank}. **\`${getShortName(entry.node)}\`** - ${entry.totalHits} CPU samples\n`;
    rank++;
  }
}

fs.writeFileSync(path.join(OUTPUT_DIR, 'CALL-GRAPH-REPORT.md'), mdReport);
console.log('Markdown report written to CALL-GRAPH-REPORT.md');
