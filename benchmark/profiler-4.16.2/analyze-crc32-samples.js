#!/usr/bin/env node
/**
 * Analyze crc32 samples in detail to understand the actual call relationship
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const profilePath = path.join(os.homedir(), 'Downloads/cnpmcore/4.16.2/r.cnpmjs.org-x-cpuprofile-325985-20251218-0');
const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));

const nodeMap = new Map();
profile.nodes.forEach(n => nodeMap.set(n.id, n));

// Find crc32 nodes
const crc32Nodes = profile.nodes.filter(n => n.callFrame.functionName === 'crc32');
console.log('=== CRC32 Nodes ===');
console.log(`Found ${crc32Nodes.length} crc32 node(s)`);
crc32Nodes.forEach(n => {
  console.log(`  Node ${n.id}: hitCount=${n.hitCount}, url=${n.callFrame.url || '(native)'}`);
});

// Check if profile has samples (time-based sampling data)
if (profile.samples && profile.timeDeltas) {
  console.log('\n=== Sample Analysis ===');
  console.log(`Total samples: ${profile.samples.length}`);

  // Count how many samples hit each crc32 node
  const crc32NodeIds = new Set(crc32Nodes.map(n => n.id));
  let crc32SampleCount = 0;
  const crc32SampleContexts = new Map();

  profile.samples.forEach((sampleId, idx) => {
    if (crc32NodeIds.has(sampleId)) {
      crc32SampleCount++;
      // Get the context (a few samples before and after)
      const contextStart = Math.max(0, idx - 2);
      const contextEnd = Math.min(profile.samples.length, idx + 3);
      const context = [];
      for (let i = contextStart; i < contextEnd; i++) {
        const node = nodeMap.get(profile.samples[i]);
        if (node) {
          context.push({
            idx: i,
            isCurrent: i === idx,
            fn: node.callFrame.functionName,
            url: node.callFrame.url || '(native)'
          });
        }
      }
      const key = context.map(c => c.fn).join(' -> ');
      if (!crc32SampleContexts.has(key)) {
        crc32SampleContexts.set(key, { count: 0, example: context });
      }
      crc32SampleContexts.get(key).count++;
    }
  });

  console.log(`Samples hitting crc32: ${crc32SampleCount}`);

  console.log('\n=== Top Sample Contexts for CRC32 ===');
  const sortedContexts = Array.from(crc32SampleContexts.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10);

  sortedContexts.forEach(([key, data], idx) => {
    console.log(`\nContext #${idx + 1} (${data.count} occurrences):`);
    data.example.forEach(c => {
      const marker = c.isCurrent ? ' <<< CRC32' : '';
      const shortUrl = c.url.includes('node_modules')
        ? c.url.split('node_modules/').pop().split('/').slice(0, 2).join('/')
        : c.url.includes('/app/')
          ? 'app/' + c.url.split('/app/').pop()
          : c.url;
      console.log(`  [${c.idx}] ${c.fn} @ ${shortUrl}${marker}`);
    });
  });
}

// Look at what's calling UserUtil (where crc32 is imported)
console.log('\n=== Searching for UserUtil-related nodes ===');
const userUtilNodes = profile.nodes.filter(n =>
  (n.callFrame.url && n.callFrame.url.includes('UserUtil')) ||
  (n.callFrame.functionName && (n.callFrame.functionName.includes('randomToken') || n.callFrame.functionName.includes('checkToken')))
);
console.log(`Found ${userUtilNodes.length} UserUtil-related node(s)`);
userUtilNodes.forEach(n => {
  console.log(`  ${n.callFrame.functionName} @ ${n.callFrame.url || '(native)'}:${n.callFrame.lineNumber} (hits: ${n.hitCount})`);
});

// Search for @node-rs/crc32 in URLs
console.log('\n=== Searching for @node-rs/crc32 nodes ===');
const nodeRsCrc32 = profile.nodes.filter(n =>
  n.callFrame.url && n.callFrame.url.includes('node-rs')
);
console.log(`Found ${nodeRsCrc32.length} @node-rs related node(s)`);
nodeRsCrc32.forEach(n => {
  console.log(`  ${n.callFrame.functionName} @ ${n.callFrame.url}:${n.callFrame.lineNumber} (hits: ${n.hitCount})`);
});
