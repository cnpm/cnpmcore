#!/usr/bin/env node

/**
 * CPU Profile Analyzer for cnpmcore
 * Analyzes V8 CPU profile files and generates detailed reports
 */

import fs from 'node:fs';
import path from 'node:path';

const PROFILE_PATH = process.argv[2] || path.join(
  process.env.HOME,
  'Downloads/cnpmcore/4.14.0/registry-npmmirror-x-cpuprofile-870954-20251209-0.cpuprofile'
);

const OUTPUT_DIR = path.dirname(new URL(import.meta.url).pathname);

class CPUProfileAnalyzer {
  constructor(profilePath) {
    this.profilePath = profilePath;
    this.profile = null;
    this.nodeMap = new Map();
    this.functionStats = new Map();
    this.totalSamples = 0;
  }

  load() {
    console.log(`Loading profile from: ${this.profilePath}`);
    const content = fs.readFileSync(this.profilePath, 'utf-8');
    this.profile = JSON.parse(content);
    console.log(`Profile type: ${this.profile.typeId || 'V8 CPU Profile'}`);
    console.log(`Title: ${this.profile.title || 'Unknown'}`);

    // Build node map for quick lookup
    for (const node of this.profile.nodes) {
      this.nodeMap.set(node.id, node);
    }

    // Calculate total samples
    this.totalSamples = this.profile.nodes.reduce((sum, n) => sum + (n.hitCount || 0), 0);
    console.log(`Total nodes: ${this.profile.nodes.length}`);
    console.log(`Total samples (hitCount): ${this.totalSamples}`);

    if (this.profile.samples) {
      console.log(`Sample count: ${this.profile.samples.length}`);
    }

    return this;
  }

  /**
   * Aggregate stats by function
   */
  aggregateByFunction() {
    for (const node of this.profile.nodes) {
      const { callFrame, hitCount } = node;
      const key = `${callFrame.url}:${callFrame.functionName}`;

      if (!this.functionStats.has(key)) {
        this.functionStats.set(key, {
          functionName: callFrame.functionName,
          url: callFrame.url,
          lineNumber: callFrame.lineNumber,
          selfTime: 0,
          totalNodes: 0,
        });
      }

      const stats = this.functionStats.get(key);
      stats.selfTime += hitCount || 0;
      stats.totalNodes += 1;
    }

    return this;
  }

  /**
   * Get top functions by self time
   */
  getTopFunctions(limit = 50) {
    const sorted = [...this.functionStats.values()]
      .filter(s => s.selfTime > 0)
      .sort((a, b) => b.selfTime - a.selfTime)
      .slice(0, limit);

    return sorted.map(s => ({
      ...s,
      percentage: ((s.selfTime / this.totalSamples) * 100).toFixed(2),
    }));
  }

  /**
   * Categorize functions by source
   */
  categorizeBySource() {
    const categories = {
      'cnpmcore (app)': { selfTime: 0, functions: [] },
      'leoric (ORM)': { selfTime: 0, functions: [] },
      'deep-equal': { selfTime: 0, functions: [] },
      'egg/tegg': { selfTime: 0, functions: [] },
      'node_modules (other)': { selfTime: 0, functions: [] },
      'node internals': { selfTime: 0, functions: [] },
      'V8/native': { selfTime: 0, functions: [] },
      'other': { selfTime: 0, functions: [] },
    };

    for (const [key, stats] of this.functionStats) {
      if (stats.selfTime === 0) continue;

      let category;
      const url = stats.url;

      if (url.includes('/app/') || url.includes('cnpmcore')) {
        category = 'cnpmcore (app)';
      } else if (url.includes('leoric')) {
        category = 'leoric (ORM)';
      } else if (url.includes('deep-equal')) {
        category = 'deep-equal';
      } else if (url.includes('egg') || url.includes('tegg')) {
        category = 'egg/tegg';
      } else if (url.includes('node_modules')) {
        category = 'node_modules (other)';
      } else if (url.includes('node:')) {
        category = 'node internals';
      } else if (!url || url === '' || url.includes('native')) {
        category = 'V8/native';
      } else {
        category = 'other';
      }

      categories[category].selfTime += stats.selfTime;
      categories[category].functions.push(stats);
    }

    // Sort categories by selfTime
    const result = Object.entries(categories)
      .map(([name, data]) => ({
        name,
        selfTime: data.selfTime,
        percentage: ((data.selfTime / this.totalSamples) * 100).toFixed(2),
        functionCount: data.functions.length,
        topFunctions: data.functions
          .sort((a, b) => b.selfTime - a.selfTime)
          .slice(0, 10),
      }))
      .sort((a, b) => b.selfTime - a.selfTime);

    return result;
  }

  /**
   * Find hot paths (call stacks with high hit counts)
   */
  findHotPaths(limit = 20) {
    const paths = [];

    const traverse = (nodeId, path = []) => {
      const node = this.nodeMap.get(nodeId);
      if (!node) return;

      const frame = node.callFrame;
      const currentPath = [...path, {
        functionName: frame.functionName,
        url: frame.url,
        line: frame.lineNumber,
      }];

      if (node.hitCount > 0) {
        paths.push({
          hitCount: node.hitCount,
          path: currentPath,
        });
      }

      if (node.children) {
        for (const childId of node.children) {
          traverse(childId, currentPath);
        }
      }
    };

    // Start from root
    traverse(1);

    return paths
      .sort((a, b) => b.hitCount - a.hitCount)
      .slice(0, limit);
  }

  /**
   * Analyze specific module patterns
   */
  analyzeModulePatterns() {
    const patterns = {
      'deep-equal calls': {
        pattern: /deep-equal/,
        selfTime: 0,
        nodes: [],
      },
      'JSON operations': {
        pattern: /JSON\.(parse|stringify)/,
        selfTime: 0,
        nodes: [],
      },
      'Buffer operations': {
        pattern: /Buffer/,
        selfTime: 0,
        nodes: [],
      },
      'Bone/Model operations': {
        pattern: /bone|Bone|Model/i,
        selfTime: 0,
        nodes: [],
      },
      'Database queries': {
        pattern: /query|Query|mysql|pg|sql/i,
        selfTime: 0,
        nodes: [],
      },
      'Async/Promise': {
        pattern: /promise|Promise|async|Async|await/i,
        selfTime: 0,
        nodes: [],
      },
    };

    for (const node of this.profile.nodes) {
      const { callFrame, hitCount } = node;
      if (hitCount === 0) continue;

      const text = `${callFrame.functionName} ${callFrame.url}`;

      for (const [name, data] of Object.entries(patterns)) {
        if (data.pattern.test(text)) {
          data.selfTime += hitCount;
          data.nodes.push({
            functionName: callFrame.functionName,
            url: callFrame.url,
            hitCount,
          });
        }
      }
    }

    return Object.entries(patterns)
      .map(([name, data]) => ({
        name,
        selfTime: data.selfTime,
        percentage: ((data.selfTime / this.totalSamples) * 100).toFixed(2),
        nodeCount: data.nodes.length,
        topNodes: data.nodes.sort((a, b) => b.hitCount - a.hitCount).slice(0, 5),
      }))
      .sort((a, b) => b.selfTime - a.selfTime);
  }

  /**
   * Generate markdown report
   */
  generateReport() {
    this.aggregateByFunction();

    const topFunctions = this.getTopFunctions(50);
    const categories = this.categorizeBySource();
    const hotPaths = this.findHotPaths(15);
    const modulePatterns = this.analyzeModulePatterns();

    let report = `# CPU Profile Analysis Report

## Profile Information

- **File**: ${path.basename(this.profilePath)}
- **Type**: ${this.profile.typeId || 'V8 CPU Profile'}
- **Total Nodes**: ${this.profile.nodes.length}
- **Total Samples**: ${this.totalSamples}
- **Analysis Date**: ${new Date().toISOString()}

---

## Executive Summary

`;

    // Add executive summary based on findings
    const topCategory = categories[0];
    report += `The CPU profile shows that **${topCategory.name}** consumes the most CPU time at **${topCategory.percentage}%** of total samples.\n\n`;

    if (categories.find(c => c.name === 'deep-equal')?.percentage > 5) {
      report += `⚠️ **Performance Warning**: \`deep-equal\` library is consuming significant CPU time. Consider optimizing comparison operations.\n\n`;
    }

    report += `---

## Category Breakdown

| Category | Self Time (samples) | Percentage | Function Count |
|----------|--------------------:|------------|---------------:|
`;

    for (const cat of categories) {
      report += `| ${cat.name} | ${cat.selfTime} | ${cat.percentage}% | ${cat.functionCount} |\n`;
    }

    report += `
---

## Top 30 Functions by Self Time

| Rank | Function | Location | Samples | % |
|-----:|----------|----------|--------:|--:|
`;

    topFunctions.slice(0, 30).forEach((fn, i) => {
      const location = fn.url ? `${path.basename(fn.url)}:${fn.lineNumber}` : '(native)';
      const funcName = fn.functionName || '(anonymous)';
      report += `| ${i + 1} | \`${funcName}\` | ${location} | ${fn.selfTime} | ${fn.percentage}% |\n`;
    });

    report += `
---

## Module Pattern Analysis

| Pattern | Self Time | Percentage | Nodes |
|---------|----------:|------------|------:|
`;

    for (const pattern of modulePatterns) {
      report += `| ${pattern.name} | ${pattern.selfTime} | ${pattern.percentage}% | ${pattern.nodeCount} |\n`;
    }

    report += `
---

## Category Details

`;

    for (const cat of categories.filter(c => c.selfTime > 0)) {
      report += `### ${cat.name} (${cat.percentage}%)

Top functions in this category:

| Function | Samples | Location |
|----------|--------:|----------|
`;
      for (const fn of cat.topFunctions.slice(0, 8)) {
        const location = fn.url ? `${path.basename(fn.url)}:${fn.lineNumber}` : '(native)';
        report += `| \`${fn.functionName || '(anonymous)'}\` | ${fn.selfTime} | ${location} |\n`;
      }
      report += '\n';
    }

    report += `---

## Hot Paths (Top Call Stacks)

These are the most frequently sampled call stacks:

`;

    hotPaths.slice(0, 10).forEach((hp, i) => {
      report += `### Path ${i + 1} (${hp.hitCount} samples, ${((hp.hitCount / this.totalSamples) * 100).toFixed(2)}%)

\`\`\`
`;
      // Show last 8 frames of the path (most relevant)
      const frames = hp.path.slice(-8);
      for (const frame of frames) {
        const loc = frame.url ? `${path.basename(frame.url)}:${frame.line}` : '';
        report += `  → ${frame.functionName || '(anonymous)'} ${loc}\n`;
      }
      report += `\`\`\`

`;
    });

    report += `---

## Optimization Recommendations

Based on the analysis:

`;

    // Generate recommendations based on findings
    const recommendations = [];

    const deepEqualCat = categories.find(c => c.name === 'deep-equal');
    if (deepEqualCat && parseFloat(deepEqualCat.percentage) > 3) {
      recommendations.push({
        priority: 'HIGH',
        title: 'Optimize deep-equal usage',
        description: `The \`deep-equal\` library is consuming ${deepEqualCat.percentage}% of CPU time. This is often used in ORM change detection. Consider:
- Using shallow comparison where possible
- Caching comparison results
- Using faster comparison libraries like \`fast-deep-equal\`
- Reducing the frequency of comparisons`,
      });
    }

    const leoricCat = categories.find(c => c.name === 'leoric (ORM)');
    if (leoricCat && parseFloat(leoricCat.percentage) > 10) {
      recommendations.push({
        priority: 'MEDIUM',
        title: 'Optimize ORM operations',
        description: `Leoric ORM is consuming ${leoricCat.percentage}% of CPU time. Consider:
- Batch operations instead of individual saves
- Using raw queries for bulk operations
- Optimizing model definitions
- Reducing unnecessary model instantiations`,
      });
    }

    const nodeInternalsCat = categories.find(c => c.name === 'node internals');
    if (nodeInternalsCat && parseFloat(nodeInternalsCat.percentage) > 20) {
      recommendations.push({
        priority: 'LOW',
        title: 'Review async patterns',
        description: `Node.js internals consume ${nodeInternalsCat.percentage}% of CPU. This may indicate:
- Heavy async/await usage (consider batching)
- Many small I/O operations (consider buffering)
- Promise chain overhead`,
      });
    }

    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'INFO',
        title: 'No major issues detected',
        description: 'The CPU profile looks relatively healthy. Continue monitoring for changes.',
      });
    }

    for (const rec of recommendations) {
      report += `### [${rec.priority}] ${rec.title}

${rec.description}

`;
    }

    report += `---

## Raw Data Files

Additional analysis files generated:
- \`top-functions.json\` - Top 100 functions by self time
- \`categories.json\` - Functions grouped by source category
- \`hot-paths.json\` - Top 50 hot call paths

---

*Generated by cnpmcore CPU Profile Analyzer*
`;

    return {
      report,
      topFunctions,
      categories,
      hotPaths,
    };
  }
}

// Main execution
async function main() {
  const analyzer = new CPUProfileAnalyzer(PROFILE_PATH);

  try {
    analyzer.load();
    const { report, topFunctions, categories, hotPaths } = analyzer.generateReport();

    // Write report
    const reportPath = path.join(OUTPUT_DIR, 'ANALYSIS-REPORT.md');
    fs.writeFileSync(reportPath, report);
    console.log(`\nReport written to: ${reportPath}`);

    // Write JSON data files
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'top-functions.json'),
      JSON.stringify(topFunctions.slice(0, 100), null, 2)
    );
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'categories.json'),
      JSON.stringify(categories, null, 2)
    );
    fs.writeFileSync(
      path.join(OUTPUT_DIR, 'hot-paths.json'),
      JSON.stringify(hotPaths.slice(0, 50), null, 2)
    );

    console.log('JSON data files written.');
    console.log('\n--- Quick Summary ---');
    console.log(`Total samples: ${analyzer.totalSamples}`);
    console.log('\nTop 10 functions:');
    topFunctions.slice(0, 10).forEach((fn, i) => {
      console.log(`  ${i + 1}. ${fn.functionName} (${fn.percentage}%) - ${fn.url ? path.basename(fn.url) : 'native'}`);
    });

  } catch (error) {
    console.error('Error analyzing profile:', error);
    process.exit(1);
  }
}

main();
