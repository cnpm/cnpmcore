#!/usr/bin/env node

/**
 * Deep analysis of Bone constructor overhead
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

// Find Bone constructor nodes
const boneNodes = profile.nodes.filter(n =>
  n.callFrame.functionName === 'Bone' &&
  n.callFrame.url.includes('bone.js')
);

console.log('=== Bone Constructor Analysis ===');
console.log('Total Bone nodes:', boneNodes.length);
console.log('Total Bone hitCount:', boneNodes.reduce((sum, n) => sum + (n.hitCount || 0), 0));

// Find all paths leading to Bone
const pathsToBone = [];

function findPathToBone(nodeId, path = []) {
  const node = nodeMap.get(nodeId);
  if (!node) return;

  const currentPath = [...path, {
    id: node.id,
    fn: node.callFrame.functionName,
    url: node.callFrame.url,
    line: node.callFrame.lineNumber,
    hitCount: node.hitCount
  }];

  if (node.callFrame.functionName === 'Bone' && node.callFrame.url.includes('bone.js')) {
    pathsToBone.push(currentPath);
    return;
  }

  if (node.children) {
    for (const childId of node.children) {
      findPathToBone(childId, currentPath);
    }
  }
}

findPathToBone(1);

console.log('\nPaths to Bone constructor:', pathsToBone.length);
console.log('\nTop paths (by hitCount):');

// Sort by hitCount of Bone node
const sortedPaths = pathsToBone
  .filter(p => p.length > 0)
  .sort((a, b) => (b[b.length - 1].hitCount || 0) - (a[a.length - 1].hitCount || 0))
  .slice(0, 10);

sortedPaths.forEach((p, i) => {
  console.log('\n--- Path', i + 1, '(hits:', p[p.length - 1].hitCount, ') ---');
  p.slice(-10).forEach(frame => {
    const basename = frame.url ? frame.url.split('/').pop() : '(native)';
    console.log('  →', frame.fn || '(anonymous)', basename + ':' + frame.line);
  });
});

// Analyze callers of Bone
console.log('\n\n=== Direct Callers of Bone ===');

const directCallers = new Map();

for (const boneNode of boneNodes) {
  // Find parent nodes
  for (const node of profile.nodes) {
    if (node.children && node.children.includes(boneNode.id)) {
      const key = `${node.callFrame.functionName}@${node.callFrame.url}:${node.callFrame.lineNumber}`;
      if (!directCallers.has(key)) {
        directCallers.set(key, {
          functionName: node.callFrame.functionName,
          url: node.callFrame.url,
          line: node.callFrame.lineNumber,
          boneHits: 0,
          count: 0
        });
      }
      directCallers.get(key).boneHits += boneNode.hitCount;
      directCallers.get(key).count += 1;
    }
  }
}

const sortedCallers = [...directCallers.values()]
  .sort((a, b) => b.boneHits - a.boneHits)
  .slice(0, 10);

console.log('\nTop callers that trigger Bone constructor:');
sortedCallers.forEach((caller, i) => {
  const basename = caller.url ? caller.url.split('/').pop() : '(native)';
  console.log(`  ${i + 1}. ${caller.functionName || '(anonymous)'} @ ${basename}:${caller.line} (Bone hits: ${caller.boneHits})`);
});

// Analyze what Bone is spending time on
console.log('\n\n=== Bone Constructor Children (what it calls) ===');

const boneChildren = new Map();

for (const boneNode of boneNodes) {
  if (boneNode.children) {
    for (const childId of boneNode.children) {
      const child = nodeMap.get(childId);
      if (child) {
        const key = `${child.callFrame.functionName}@${child.callFrame.url}`;
        if (!boneChildren.has(key)) {
          boneChildren.set(key, {
            functionName: child.callFrame.functionName,
            url: child.callFrame.url,
            line: child.callFrame.lineNumber,
            hitCount: 0,
            count: 0
          });
        }
        boneChildren.get(key).hitCount += child.hitCount || 0;
        boneChildren.get(key).count += 1;
      }
    }
  }
}

const sortedChildren = [...boneChildren.values()]
  .sort((a, b) => b.hitCount - a.hitCount)
  .slice(0, 10);

console.log('\nTop functions called by Bone constructor:');
sortedChildren.forEach((child, i) => {
  const basename = child.url ? child.url.split('/').pop() : '(native)';
  console.log(`  ${i + 1}. ${child.functionName || '(anonymous)'} @ ${basename}:${child.line} (hits: ${child.hitCount})`);
});

// Analyze instantiate function
console.log('\n\n=== instantiate Function Analysis ===');

const instantiateNodes = profile.nodes.filter(n =>
  n.callFrame.functionName === 'instantiate' &&
  n.callFrame.url.includes('bone.js')
);

console.log('Total instantiate nodes:', instantiateNodes.length);
console.log('Total instantiate hitCount:', instantiateNodes.reduce((sum, n) => sum + (n.hitCount || 0), 0));

// Analyze ContextModelClass
console.log('\n\n=== ContextModelClass/SingletonModelObject Analysis ===');

const modelClassNodes = profile.nodes.filter(n =>
  (n.callFrame.functionName === 'ContextModelClass' || n.callFrame.url.includes('SingletonModelObject'))
);

console.log('Total model class nodes:', modelClassNodes.length);
modelClassNodes.forEach(n => {
  console.log(`  - ${n.callFrame.functionName} @ ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber} (hits: ${n.hitCount})`);
});
