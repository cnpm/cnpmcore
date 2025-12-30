#!/usr/bin/env node

/**
 * CPU Profile Analyzer for cnpmcore
 * Analyzes V8 CPU profile files and generates hotspot reports
 */

import fs from 'node:fs';
import path from 'node:path';

const PROFILE_DIR = process.env.PROFILE_DIR || path.join(process.env.HOME, 'Downloads/cnpmcore/4.18.0');
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.dirname(new URL(import.meta.url).pathname);
const CNPMCORE_ROOT = process.env.CNPMCORE_ROOT || path.join(process.env.HOME, 'git/github.com/cnpm/cnpmcore');

class CpuProfileAnalyzer {
  constructor(profilePath) {
    this.profilePath = profilePath;
    this.profile = null;
    this.nodeMap = new Map();
    this.totalSamples = 0;
    this.sampleDuration = 0;
  }

  load() {
    const content = fs.readFileSync(this.profilePath, 'utf-8');
    this.profile = JSON.parse(content);
    this.totalSamples = this.profile.samples?.length || 0;

    // Calculate total duration in ms
    const timeDeltas = this.profile.timeDeltas || [];
    this.sampleDuration = timeDeltas.reduce((sum, delta) => sum + delta, 0) / 1000; // microseconds to ms

    // Build node map for quick lookup
    for (const node of this.profile.nodes) {
      this.nodeMap.set(node.id, node);
    }

    return this;
  }

  getProfileInfo() {
    return {
      fileName: path.basename(this.profilePath),
      nodeCount: this.profile.nodes.length,
      sampleCount: this.totalSamples,
      durationMs: this.sampleDuration,
      durationSec: (this.sampleDuration / 1000).toFixed(2),
    };
  }

  /**
   * Calculate self time (direct hits) and total time (including children) for each node
   */
  calculateTimes() {
    // Count direct hits from samples
    const hitCounts = new Map();
    for (const sampleId of this.profile.samples || []) {
      hitCounts.set(sampleId, (hitCounts.get(sampleId) || 0) + 1);
    }

    // Update nodes with calculated hit counts
    const nodeStats = new Map();
    for (const node of this.profile.nodes) {
      const selfHits = hitCounts.get(node.id) || 0;
      nodeStats.set(node.id, {
        node,
        selfHits,
        selfTime: selfHits,
        totalTime: 0, // Will calculate recursively
      });
    }

    // Calculate total time recursively (DFS from root)
    const calculateTotal = (nodeId, visited = new Set()) => {
      if (visited.has(nodeId)) return 0;
      visited.add(nodeId);

      const stats = nodeStats.get(nodeId);
      if (!stats) return 0;

      let total = stats.selfHits;
      for (const childId of stats.node.children || []) {
        total += calculateTotal(childId, visited);
      }
      stats.totalTime = total;
      return total;
    };

    // Start from root (id: 1)
    calculateTotal(1);

    return nodeStats;
  }

  /**
   * Get hotspot functions sorted by self time
   */
  getHotspots(limit = 50) {
    const nodeStats = this.calculateTimes();
    const hotspots = [];

    for (const [id, stats] of nodeStats) {
      const { node, selfHits, selfTime, totalTime } = stats;
      const callFrame = node.callFrame;

      if (selfHits === 0) continue;

      hotspots.push({
        id,
        functionName: callFrame.functionName || '(anonymous)',
        url: callFrame.url,
        lineNumber: callFrame.lineNumber,
        columnNumber: callFrame.columnNumber,
        selfHits,
        selfPercent: ((selfHits / this.totalSamples) * 100).toFixed(2),
        totalHits: totalTime,
        totalPercent: ((totalTime / this.totalSamples) * 100).toFixed(2),
        isCnpmcore: this.isCnpmcoreCode(callFrame.url),
        category: this.categorizeUrl(callFrame.url),
      });
    }

    return hotspots.sort((a, b) => b.selfHits - a.selfHits).slice(0, limit);
  }

  /**
   * Check if URL belongs to cnpmcore project
   */
  isCnpmcoreCode(url) {
    if (!url) return false;
    return url.includes('/cnpmcore/') || url.includes('/application/');
  }

  /**
   * Categorize URL into groups
   */
  categorizeUrl(url) {
    if (!url) return 'unknown';
    if (url.startsWith('node:')) return 'node-internal';
    if (url.includes('/node_modules/')) {
      // Extract package name
      const match = url.match(/node_modules\/(_[^@]+@[^@]+@)?(@[^/]+\/[^/]+|[^/]+)/);
      if (match) {
        return `npm:${match[2] || match[1]}`;
      }
      return 'npm:unknown';
    }
    if (url.includes('/cnpmcore/') || url.includes('/application/')) {
      return 'cnpmcore';
    }
    return 'other';
  }

  /**
   * Get cnpmcore-specific hotspots
   */
  getCnpmcoreHotspots(limit = 30) {
    return this.getHotspots(1000)
      .filter((h) => h.isCnpmcore)
      .slice(0, limit);
  }

  /**
   * Get call graph for a specific node
   */
  getCallGraph(nodeId, depth = 3) {
    const node = this.nodeMap.get(nodeId);
    if (!node) return null;

    const buildGraph = (n, currentDepth) => {
      if (currentDepth > depth) return null;

      const children = (n.children || [])
        .map((childId) => {
          const child = this.nodeMap.get(childId);
          if (!child) return null;
          return buildGraph(child, currentDepth + 1);
        })
        .filter(Boolean)
        .sort((a, b) => (b.hitCount || 0) - (a.hitCount || 0))
        .slice(0, 5); // Top 5 children

      return {
        id: n.id,
        functionName: n.callFrame.functionName || '(anonymous)',
        url: n.callFrame.url,
        lineNumber: n.callFrame.lineNumber,
        hitCount: n.hitCount,
        children: children.length > 0 ? children : undefined,
      };
    };

    return buildGraph(node, 0);
  }

  /**
   * Find callers of a function (reverse call graph)
   */
  findCallers(functionName) {
    const callers = [];

    for (const node of this.profile.nodes) {
      if (!node.children) continue;

      for (const childId of node.children) {
        const child = this.nodeMap.get(childId);
        if (child && child.callFrame.functionName === functionName) {
          callers.push({
            callerId: node.id,
            callerName: node.callFrame.functionName,
            callerUrl: node.callFrame.url,
            targetId: childId,
            targetHitCount: child.hitCount,
          });
        }
      }
    }

    return callers;
  }

  /**
   * Aggregate stats by category
   */
  getCategoryStats() {
    const nodeStats = this.calculateTimes();
    const categoryStats = new Map();

    for (const [, stats] of nodeStats) {
      const category = this.categorizeUrl(stats.node.callFrame.url);
      const current = categoryStats.get(category) || { selfHits: 0, nodeCount: 0 };
      current.selfHits += stats.selfHits;
      current.nodeCount++;
      categoryStats.set(category, current);
    }

    return Array.from(categoryStats.entries())
      .map(([category, stats]) => ({
        category,
        selfHits: stats.selfHits,
        selfPercent: ((stats.selfHits / this.totalSamples) * 100).toFixed(2),
        nodeCount: stats.nodeCount,
      }))
      .sort((a, b) => b.selfHits - a.selfHits);
  }
}

/**
 * Generate Mermaid diagram for call graph
 */
function generateMermaidDiagram(hotspots, analyzer) {
  const lines = ['graph TD'];
  const nodeIds = new Map();
  let counter = 0;

  const getNodeId = (name) => {
    if (!nodeIds.has(name)) {
      nodeIds.set(name, `N${counter++}`);
    }
    return nodeIds.get(name);
  };

  const sanitizeName = (name) => {
    return name.replace(/[<>{}|[\]\\/]/g, '_').slice(0, 40);
  };

  // Get top hotspots and their call relationships
  const topHotspots = hotspots.slice(0, 15);

  for (const hotspot of topHotspots) {
    const node = analyzer.nodeMap.get(hotspot.id);
    if (!node || !node.children) continue;

    const parentId = getNodeId(hotspot.functionName);
    const parentLabel = sanitizeName(hotspot.functionName);

    // Add parent node with hit count
    lines.push(`    ${parentId}["${parentLabel}<br/>${hotspot.selfPercent}%"]`);

    // Add children relationships (top 3)
    const topChildren = node.children
      .map((cid) => analyzer.nodeMap.get(cid))
      .filter(Boolean)
      .sort((a, b) => (b.hitCount || 0) - (a.hitCount || 0))
      .slice(0, 3);

    for (const child of topChildren) {
      if (child.hitCount > 0) {
        const childId = getNodeId(child.callFrame.functionName);
        const childLabel = sanitizeName(child.callFrame.functionName);
        lines.push(`    ${parentId} --> ${childId}["${childLabel}"]`);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Main analysis function
 */
async function main() {
  console.log('CPU Profile Analyzer for cnpmcore 4.18.0\n');
  console.log('='.repeat(60));

  const profileFiles = fs
    .readdirSync(PROFILE_DIR)
    .filter((f) => f.includes('cpuprofile'))
    .map((f) => path.join(PROFILE_DIR, f));

  if (profileFiles.length === 0) {
    console.error('No cpuprofile files found in:', PROFILE_DIR);
    process.exit(1);
  }

  console.log(`Found ${profileFiles.length} profile files\n`);

  const results = [];

  for (const profilePath of profileFiles) {
    console.log(`\nAnalyzing: ${path.basename(profilePath)}`);
    console.log('-'.repeat(60));

    const analyzer = new CpuProfileAnalyzer(profilePath).load();
    const info = analyzer.getProfileInfo();

    console.log(`  Nodes: ${info.nodeCount}`);
    console.log(`  Samples: ${info.sampleCount}`);
    console.log(`  Duration: ${info.durationSec}s`);

    const hotspots = analyzer.getHotspots(50);
    const cnpmcoreHotspots = analyzer.getCnpmcoreHotspots(30);
    const categoryStats = analyzer.getCategoryStats();

    results.push({
      info,
      hotspots,
      cnpmcoreHotspots,
      categoryStats,
      analyzer,
    });
  }

  // Generate combined report
  const report = generateReport(results);

  const reportPath = path.join(OUTPUT_DIR, 'ANALYSIS_REPORT.md');
  fs.writeFileSync(reportPath, report);
  console.log(`\nReport saved to: ${reportPath}`);

  // Generate JSON data for further analysis
  const jsonData = results.map((r) => ({
    info: r.info,
    hotspots: r.hotspots,
    cnpmcoreHotspots: r.cnpmcoreHotspots,
    categoryStats: r.categoryStats,
  }));

  const jsonPath = path.join(OUTPUT_DIR, 'analysis-data.json');
  fs.writeFileSync(jsonPath, JSON.stringify(jsonData, null, 2));
  console.log(`JSON data saved to: ${jsonPath}`);
}

/**
 * Generate markdown report
 */
function generateReport(results) {
  const lines = [];

  lines.push('# cnpmcore 4.18.0 CPU Profile Analysis Report');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  lines.push('## Overview');
  lines.push('');
  lines.push('| Profile | Nodes | Samples | Duration |');
  lines.push('|---------|-------|---------|----------|');
  for (const { info } of results) {
    lines.push(`| ${info.fileName.slice(0, 40)}... | ${info.nodeCount} | ${info.sampleCount} | ${info.durationSec}s |`);
  }
  lines.push('');

  // Aggregate analysis across all profiles
  lines.push('## CPU Time Distribution by Category');
  lines.push('');

  const aggregatedCategories = new Map();
  let totalSamples = 0;

  for (const { categoryStats, info } of results) {
    totalSamples += info.sampleCount;
    for (const cat of categoryStats) {
      const current = aggregatedCategories.get(cat.category) || 0;
      aggregatedCategories.set(cat.category, current + cat.selfHits);
    }
  }

  const sortedCategories = Array.from(aggregatedCategories.entries()).sort((a, b) => b[1] - a[1]);

  lines.push('| Category | Self Time % | Samples |');
  lines.push('|----------|-------------|---------|');
  for (const [category, hits] of sortedCategories) {
    const percent = ((hits / totalSamples) * 100).toFixed(2);
    lines.push(`| ${category} | ${percent}% | ${hits} |`);
  }
  lines.push('');

  // Top hotspots across all profiles
  lines.push('## Top 30 Overall Hotspots (by Self Time)');
  lines.push('');
  lines.push('| # | Function | Category | Self % | Location |');
  lines.push('|---|----------|----------|--------|----------|');

  const allHotspots = results.flatMap((r) => r.hotspots);
  const aggregatedHotspots = new Map();

  for (const h of allHotspots) {
    const key = `${h.functionName}@${h.url}:${h.lineNumber}`;
    const current = aggregatedHotspots.get(key) || { ...h, selfHits: 0 };
    current.selfHits += h.selfHits;
    aggregatedHotspots.set(key, current);
  }

  const topHotspots = Array.from(aggregatedHotspots.values())
    .sort((a, b) => b.selfHits - a.selfHits)
    .slice(0, 30);

  for (let i = 0; i < topHotspots.length; i++) {
    const h = topHotspots[i];
    const percent = ((h.selfHits / totalSamples) * 100).toFixed(2);
    const location = h.url ? `${path.basename(h.url)}:${h.lineNumber}` : 'native';
    lines.push(`| ${i + 1} | \`${h.functionName.slice(0, 40)}\` | ${h.category} | ${percent}% | ${location} |`);
  }
  lines.push('');

  // cnpmcore-specific hotspots
  lines.push('## cnpmcore Code Hotspots');
  lines.push('');
  lines.push('These are the hottest functions within the cnpmcore codebase itself:');
  lines.push('');
  lines.push('| # | Function | Self % | File:Line |');
  lines.push('|---|----------|--------|-----------|');

  const allCnpmcoreHotspots = results.flatMap((r) => r.cnpmcoreHotspots);
  const aggregatedCnpmcore = new Map();

  for (const h of allCnpmcoreHotspots) {
    const key = `${h.functionName}@${h.url}:${h.lineNumber}`;
    const current = aggregatedCnpmcore.get(key) || { ...h, selfHits: 0 };
    current.selfHits += h.selfHits;
    aggregatedCnpmcore.set(key, current);
  }

  const topCnpmcore = Array.from(aggregatedCnpmcore.values())
    .sort((a, b) => b.selfHits - a.selfHits)
    .slice(0, 20);

  for (let i = 0; i < topCnpmcore.length; i++) {
    const h = topCnpmcore[i];
    const percent = ((h.selfHits / totalSamples) * 100).toFixed(2);
    const filePath = h.url ? h.url.replace(/.*\/application\//, '') : 'unknown';
    lines.push(`| ${i + 1} | \`${h.functionName}\` | ${percent}% | ${filePath}:${h.lineNumber} |`);
  }
  lines.push('');

  // NPM dependency analysis
  lines.push('## NPM Dependency CPU Usage');
  lines.push('');
  lines.push('CPU time spent in npm dependencies:');
  lines.push('');

  const npmDeps = sortedCategories.filter(([cat]) => cat.startsWith('npm:')).slice(0, 15);

  lines.push('| Package | Self Time % |');
  lines.push('|---------|-------------|');
  for (const [category, hits] of npmDeps) {
    const percent = ((hits / totalSamples) * 100).toFixed(2);
    const pkgName = category.replace('npm:', '');
    lines.push(`| ${pkgName} | ${percent}% |`);
  }
  lines.push('');

  // Call graph for top cnpmcore functions
  lines.push('## Call Relationship Diagram');
  lines.push('');
  lines.push('Top cnpmcore hotspot functions and their call relationships:');
  lines.push('');
  lines.push('```mermaid');

  if (results.length > 0 && topCnpmcore.length > 0) {
    lines.push(generateMermaidDiagram(topCnpmcore, results[0].analyzer));
  }

  lines.push('```');
  lines.push('');

  // Recommendations
  lines.push('## Optimization Recommendations');
  lines.push('');
  lines.push('Based on the profile analysis:');
  lines.push('');

  // Analyze node-internal percentage
  const nodeInternalPercent =
    (sortedCategories.filter(([cat]) => cat === 'node-internal').reduce((sum, [, hits]) => sum + hits, 0) /
      totalSamples) *
    100;

  if (nodeInternalPercent > 30) {
    lines.push(`1. **High Node.js Internal Overhead (${nodeInternalPercent.toFixed(1)}%)**: Consider:
   - Reducing async operations
   - Batching I/O operations
   - Using streaming for large data`);
  }

  // Analyze specific npm packages
  for (const [category, hits] of npmDeps.slice(0, 5)) {
    const percent = (hits / totalSamples) * 100;
    if (percent > 5) {
      const pkgName = category.replace('npm:', '');
      lines.push(`2. **${pkgName} (${percent.toFixed(1)}%)**: Review usage of this dependency`);
    }
  }

  lines.push('');
  lines.push('## Files for Further Investigation');
  lines.push('');

  const fileHotspots = new Map();
  for (const h of topCnpmcore) {
    if (!h.url) continue;
    const filePath = h.url.replace(/.*\/application\//, '');
    const current = fileHotspots.get(filePath) || 0;
    fileHotspots.set(filePath, current + h.selfHits);
  }

  const sortedFiles = Array.from(fileHotspots.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  for (const [file, hits] of sortedFiles) {
    const percent = ((hits / totalSamples) * 100).toFixed(2);
    lines.push(`- \`${file}\` (${percent}%)`);
  }

  return lines.join('\n');
}

main().catch(console.error);
