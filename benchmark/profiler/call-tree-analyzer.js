#!/usr/bin/env node
/**
 * Analyze call relationships between application code and specific hotspots
 * Usage: node call-tree-analyzer.js <profile.cpuprofile> [--target=pattern] [--caller=pattern]
 */

import fs from 'node:fs';

const args = process.argv.slice(2);
let profilePath = null;
let targetPattern = 'Bone';
let callerPattern = 'application';

for (const arg of args) {
  if (arg.startsWith('--target=')) {
    targetPattern = arg.substring(9);
  } else if (arg.startsWith('--caller=')) {
    callerPattern = arg.substring(9);
  } else if (!arg.startsWith('--')) {
    profilePath = arg;
  }
}

if (!profilePath) {
  console.error('Usage: node call-tree-analyzer.js <profile.cpuprofile> [--target=pattern] [--caller=pattern]');
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
      if (!parentMap.has(childId)) {
        parentMap.set(childId, []);
      }
      parentMap.get(childId).push(node.id);
    });
  }
});

// Find all target nodes (hotspots)
const targetRegex = new RegExp(targetPattern, 'i');
const callerRegex = new RegExp(callerPattern, 'i');

const targetNodes = profile.nodes.filter((n) => {
  const name = n.callFrame.functionName || '';
  const url = n.callFrame.url || '';
  return n.hitCount > 0 && (targetRegex.test(name) || targetRegex.test(url));
});

// Get full call path from root to node
function getFullPath(nodeId, maxDepth = 30) {
  const path = [];
  let currentId = nodeId;
  let depth = 0;

  while (currentId && depth < maxDepth) {
    const node = nodeMap.get(currentId);
    if (!node) break;

    const cf = node.callFrame;
    const name = cf.functionName || '(anonymous)';
    const url = cf.url || '';

    // Categorize the node
    let category = 'native';
    let shortLocation = '';

    if (url.includes('node:')) {
      category = 'node';
      shortLocation = url;
    } else if (url.includes('node_modules')) {
      category = 'npm';
      const match = url.match(/node_modules\/_?([^@][^/]*|@[^/]+\/[^/]+)/);
      shortLocation = match ? match[1] : url.split('/').slice(-2).join('/');
    } else if (url.includes('application/') || url.includes('/app/')) {
      category = 'app';
      const match = url.match(/(?:application|app)\/(.+)/);
      shortLocation = match ? match[1] : url.split('/').slice(-2).join('/');
    }

    if (name !== '(root)' && name !== '(idle)' && name !== '(program)') {
      path.unshift({
        id: node.id,
        name,
        url,
        category,
        shortLocation,
        line: cf.lineNumber,
        hitCount: node.hitCount,
      });
    }

    const parents = parentMap.get(currentId);
    currentId = parents && parents.length > 0 ? parents[0] : null;
    depth++;
  }

  return path;
}

// Group paths by application entry point
const pathsByAppEntry = new Map();
const pathsWithoutApp = [];

targetNodes.forEach((node) => {
  const path = getFullPath(node.id);

  // Find the deepest application code in the path
  let appEntryIdx = -1;
  for (let i = path.length - 1; i >= 0; i--) {
    if (path[i].category === 'app') {
      appEntryIdx = i;
      break;
    }
  }

  if (appEntryIdx >= 0) {
    const appEntry = path[appEntryIdx];
    const key = `${appEntry.name}@${appEntry.shortLocation}:${appEntry.line}`;

    if (!pathsByAppEntry.has(key)) {
      pathsByAppEntry.set(key, {
        entry: appEntry,
        paths: [],
        totalHits: 0,
      });
    }

    const group = pathsByAppEntry.get(key);
    group.paths.push({ path, targetNode: node });
    group.totalHits += node.hitCount;
  } else {
    pathsWithoutApp.push({ path, targetNode: node });
  }
});

// Sort by total hits
const sortedGroups = Array.from(pathsByAppEntry.entries()).sort((a, b) => b[1].totalHits - a[1].totalHits);

console.log('='.repeat(120));
console.log(`Call Relationships: Application Code → ${targetPattern} Hotspots`);
console.log('='.repeat(120));

console.log(`\nFound ${targetNodes.length} hotspot nodes matching "${targetPattern}"`);
console.log(`Grouped into ${sortedGroups.length} application entry points\n`);

// Print each group
sortedGroups.forEach(([key, group], idx) => {
  console.log(`\n${'─'.repeat(120)}`);
  console.log(`## Entry Point #${idx + 1}: ${group.entry.name}`);
  console.log(`   Location: ${group.entry.shortLocation}:${group.entry.line}`);
  console.log(`   Total Hits: ${group.totalHits}`);
  console.log(`   Unique Paths: ${group.paths.length}`);

  // Show the most common path
  const pathCounts = new Map();
  group.paths.forEach(({ path, targetNode }) => {
    // Create a simplified path key
    const pathKey = path
      .filter((p) => p.category !== 'node') // Skip node internals
      .map((p) => `${p.name}[${p.category}]`)
      .join(' → ');

    if (!pathCounts.has(pathKey)) {
      pathCounts.set(pathKey, { count: 0, hits: 0, examplePath: path });
    }
    const pc = pathCounts.get(pathKey);
    pc.count++;
    pc.hits += targetNode.hitCount;
  });

  const sortedPaths = Array.from(pathCounts.entries())
    .sort((a, b) => b[1].hits - a[1].hits)
    .slice(0, 3);

  console.log('\n   Top Call Paths:');
  sortedPaths.forEach(([pathKey, data], pathIdx) => {
    console.log(`\n   Path ${pathIdx + 1} (${data.hits} hits, ${data.count} occurrences):`);

    // Show detailed path with better formatting
    const detailedPath = data.examplePath;
    let indent = '   ';

    detailedPath.forEach((node, i) => {
      let prefix = i === 0 ? '   ' : '   │';
      let connector = i === detailedPath.length - 1 ? '└─▶' : '├─▶';

      let categoryTag = '';
      switch (node.category) {
        case 'app':
          categoryTag = '[APP]';
          break;
        case 'npm':
          categoryTag = '[NPM]';
          break;
        case 'node':
          categoryTag = '[NODE]';
          break;
        default:
          categoryTag = '[V8]';
      }

      const location = node.shortLocation ? `${node.shortLocation}:${node.line}` : '(native)';
      const hitInfo = node.hitCount > 0 ? ` (${node.hitCount} hits)` : '';

      console.log(`   ${connector} ${categoryTag} ${node.name} @ ${location}${hitInfo}`);
    });
  });
});

// Show paths without application code
if (pathsWithoutApp.length > 0) {
  const noAppHits = pathsWithoutApp.reduce((sum, p) => sum + p.targetNode.hitCount, 0);
  console.log(`\n${'─'.repeat(120)}`);
  console.log(`## Paths without Application Code: ${pathsWithoutApp.length} paths, ${noAppHits} total hits`);
  console.log('   (These are triggered by Node.js internals, timers, or async operations)');
}

// Generate Mermaid diagram
console.log(`\n${'═'.repeat(120)}`);
console.log('MERMAID FLOWCHART (copy to https://mermaid.live)');
console.log('═'.repeat(120));
console.log('\n```mermaid');
console.log('flowchart TD');
console.log('    subgraph Application["Application Layer"]');

const appNodes = new Set();
const npmNodes = new Set();
const edges = new Set();

sortedGroups.slice(0, 10).forEach(([key, group]) => {
  const appNodeId = `app_${group.entry.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
  appNodes.add({ id: appNodeId, name: group.entry.name, location: group.entry.shortLocation, hits: group.totalHits });

  // Find intermediate NPM packages
  group.paths.slice(0, 5).forEach(({ path }) => {
    let lastAppNode = appNodeId;

    path.forEach((node, i) => {
      if (node.category === 'npm') {
        const npmNodeId = `npm_${node.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
        npmNodes.add({ id: npmNodeId, name: node.name, pkg: node.shortLocation });

        const edgeKey = `${lastAppNode}-->${npmNodeId}`;
        edges.add(edgeKey);
        lastAppNode = npmNodeId;
      }
    });

    // Connect to Bone
    if (lastAppNode !== appNodeId) {
      edges.add(`${lastAppNode}-->bone["Bone Constructor"]`);
    } else {
      edges.add(`${lastAppNode}-->bone["Bone Constructor"]`);
    }
  });
});

appNodes.forEach((node) => {
  console.log(`        ${node.id}["${node.name}<br/>${node.location}<br/>${node.hits} hits"]`);
});
console.log('    end');

console.log('    subgraph NPM["NPM Packages"]');
npmNodes.forEach((node) => {
  console.log(`        ${node.id}["${node.name}<br/>${node.pkg}"]`);
});
console.log('        bone["Bone Constructor<br/>leoric/lib/bone.js:150<br/>1553 hits"]');
console.log('    end');

console.log('');
edges.forEach((edge) => {
  console.log(`    ${edge}`);
});

console.log('```');
console.log('');
