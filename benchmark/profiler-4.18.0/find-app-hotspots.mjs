#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const data = JSON.parse(fs.readFileSync('benchmark/profiler-4.18.0/analysis-data.json', 'utf-8'));

// Get all hotspots across both profiles
const allHotspots = data.flatMap((d) => d.hotspots);

// Find actual cnpmcore app code (not node_modules)
const appHotspots = allHotspots.filter((h) => {
  if (!h.url) return false;
  const isAppCode = h.url.includes('/application/app/') || h.url.includes('/application/dist/');
  const isNotNodeModules = !h.url.includes('node_modules');
  return isAppCode && isNotNodeModules;
});

// Aggregate and sort
const aggregated = {};
for (const h of appHotspots) {
  const key = h.functionName + '@' + h.url + ':' + h.lineNumber;
  if (!aggregated[key]) {
    aggregated[key] = { ...h, selfHits: 0 };
  }
  aggregated[key].selfHits += h.selfHits;
}

const sorted = Object.values(aggregated)
  .sort((a, b) => b.selfHits - a.selfHits)
  .slice(0, 30);

console.log('Top 30 cnpmcore app code hotspots:');
console.log('='.repeat(80));
for (const h of sorted) {
  const url = h.url.replace(/.*\/application\//, '');
  console.log(h.functionName.padEnd(35), h.selfHits.toString().padStart(6), url + ':' + h.lineNumber);
}

// Calculate total hits for percentage
const totalSamples = data.reduce((sum, d) => sum + d.info.sampleCount, 0);
console.log('\nTotal samples:', totalSamples);
console.log('\nPercentages:');
for (const h of sorted.slice(0, 15)) {
  const url = h.url.replace(/.*\/application\//, '');
  const percent = ((h.selfHits / totalSamples) * 100).toFixed(3);
  console.log(`${percent}%`.padStart(8), h.functionName.padEnd(35), url + ':' + h.lineNumber);
}
