#!/usr/bin/env node

/**
 * Compare two CPU profiles side by side
 *
 * Usage:
 *   node compare-profiles.js <profile1.cpuprofile> <profile2.cpuprofile>
 */

import fs from 'node:fs';
import path from 'node:path';

class ProfileComparator {
  constructor(profile1Path, profile2Path) {
    this.profile1Path = profile1Path;
    this.profile2Path = profile2Path;
    this.profile1 = null;
    this.profile2 = null;
    this.stats1 = null;
    this.stats2 = null;
  }

  load() {
    this.profile1 = JSON.parse(fs.readFileSync(this.profile1Path, 'utf-8'));
    this.profile2 = JSON.parse(fs.readFileSync(this.profile2Path, 'utf-8'));
    this.stats1 = this.calculateStats(this.profile1);
    this.stats2 = this.calculateStats(this.profile2);
    return this;
  }

  calculateStats(profile) {
    const stats = {
      totalHits: 0,
      nodes: profile.nodes.length,
      functions: new Map(),
      modules: new Map(),
    };

    for (const node of profile.nodes) {
      stats.totalHits += node.hitCount || 0;

      const frame = node.callFrame;
      const fnKey = `${frame.functionName}|${frame.url}|${frame.lineNumber}`;
      const url = frame.url || '';

      // Function stats
      if (!stats.functions.has(fnKey)) {
        stats.functions.set(fnKey, {
          name: frame.functionName || '(anonymous)',
          url: frame.url || '(native)',
          line: frame.lineNumber,
          hits: 0,
        });
      }
      stats.functions.get(fnKey).hits += node.hitCount || 0;

      // Module stats
      let module = '(native/gc)';
      if (url.includes('node_modules')) {
        const match = url.match(/node_modules\/_?([^@/]+(?:@[^/]+)?@[^/]+|[^/]+)/);
        if (match) {
          module = match[1].replace(/@[0-9.]+@/, '@');
        }
      } else if (url.startsWith('node:')) {
        module = 'node:' + url.split('/')[0].replace('node:', '');
      } else if (url.includes('/application/')) {
        module = 'cnpmcore (app)';
      }

      if (!stats.modules.has(module)) {
        stats.modules.set(module, { hits: 0, functions: new Set() });
      }
      const modStat = stats.modules.get(module);
      modStat.hits += node.hitCount || 0;
      modStat.functions.add(frame.functionName || '(anonymous)');
    }

    return stats;
  }

  compare() {
    const report = {
      summary: {
        profile1: {
          file: path.basename(this.profile1Path),
          totalHits: this.stats1.totalHits,
          nodes: this.stats1.nodes,
        },
        profile2: {
          file: path.basename(this.profile2Path),
          totalHits: this.stats2.totalHits,
          nodes: this.stats2.nodes,
        },
      },
      moduleComparison: [],
      functionComparison: [],
    };

    // Compare modules
    const allModules = new Set([
      ...this.stats1.modules.keys(),
      ...this.stats2.modules.keys(),
    ]);

    for (const mod of allModules) {
      const hits1 = this.stats1.modules.get(mod)?.hits || 0;
      const hits2 = this.stats2.modules.get(mod)?.hits || 0;
      const pct1 = this.stats1.totalHits > 0
        ? ((hits1 / this.stats1.totalHits) * 100).toFixed(2)
        : '0.00';
      const pct2 = this.stats2.totalHits > 0
        ? ((hits2 / this.stats2.totalHits) * 100).toFixed(2)
        : '0.00';
      const diff = (parseFloat(pct2) - parseFloat(pct1)).toFixed(2);

      report.moduleComparison.push({
        module: mod,
        hits1,
        pct1,
        hits2,
        pct2,
        diff,
      });
    }

    report.moduleComparison.sort((a, b) => b.hits1 + b.hits2 - a.hits1 - a.hits2);

    // Compare top functions
    const allFunctions = new Map();
    for (const [key, stat] of this.stats1.functions) {
      allFunctions.set(key, { ...stat, hits1: stat.hits, hits2: 0 });
    }
    for (const [key, stat] of this.stats2.functions) {
      if (allFunctions.has(key)) {
        allFunctions.get(key).hits2 = stat.hits;
      } else {
        allFunctions.set(key, { ...stat, hits1: 0, hits2: stat.hits });
      }
    }

    report.functionComparison = Array.from(allFunctions.values())
      .map(fn => {
        const pct1 = this.stats1.totalHits > 0
          ? ((fn.hits1 / this.stats1.totalHits) * 100).toFixed(3)
          : '0.000';
        const pct2 = this.stats2.totalHits > 0
          ? ((fn.hits2 / this.stats2.totalHits) * 100).toFixed(3)
          : '0.000';
        return {
          ...fn,
          pct1,
          pct2,
          diff: (parseFloat(pct2) - parseFloat(pct1)).toFixed(3),
        };
      })
      .filter(fn => fn.hits1 > 0 || fn.hits2 > 0)
      .sort((a, b) => (b.hits1 + b.hits2) - (a.hits1 + a.hits2));

    return report;
  }

  formatMarkdown(report) {
    let md = '# CPU Profile Comparison Report\n\n';
    md += `Generated: ${new Date().toISOString()}\n\n`;

    // Summary
    md += '## Summary\n\n';
    md += '| Metric | Profile 1 | Profile 2 |\n';
    md += '|--------|-----------|----------|\n';
    md += `| File | ${report.summary.profile1.file} | ${report.summary.profile2.file} |\n`;
    md += `| Total Hits | ${report.summary.profile1.totalHits} | ${report.summary.profile2.totalHits} |\n`;
    md += `| Nodes | ${report.summary.profile1.nodes} | ${report.summary.profile2.nodes} |\n\n`;

    // Module comparison
    md += '## Module Comparison\n\n';
    md += '| Module | P1 Hits | P1 % | P2 Hits | P2 % | Diff |\n';
    md += '|--------|---------|------|---------|------|------|\n';
    for (const mod of report.moduleComparison.slice(0, 20)) {
      const diffStr = parseFloat(mod.diff) > 0 ? `+${mod.diff}` : mod.diff;
      md += `| ${mod.module} | ${mod.hits1} | ${mod.pct1}% | ${mod.hits2} | ${mod.pct2}% | ${diffStr}% |\n`;
    }
    md += '\n';

    // Top function differences
    md += '## Top Functions by Total Hits\n\n';
    md += '| Function | Location | P1 Hits | P1 % | P2 Hits | P2 % | Diff |\n';
    md += '|----------|----------|---------|------|---------|------|------|\n';
    for (const fn of report.functionComparison.slice(0, 30)) {
      const location = fn.url
        ? `${path.basename(fn.url)}:${fn.line}`
        : '(native)';
      const diffStr = parseFloat(fn.diff) > 0 ? `+${fn.diff}` : fn.diff;
      md += `| ${fn.name} | ${location} | ${fn.hits1} | ${fn.pct1}% | ${fn.hits2} | ${fn.pct2}% | ${diffStr}% |\n`;
    }
    md += '\n';

    // Significant changes
    md += '## Significant Changes (>0.05% difference)\n\n';
    const significantChanges = report.functionComparison
      .filter(fn => Math.abs(parseFloat(fn.diff)) > 0.05)
      .sort((a, b) => Math.abs(parseFloat(b.diff)) - Math.abs(parseFloat(a.diff)));

    if (significantChanges.length > 0) {
      md += '| Function | Location | P1 % | P2 % | Diff |\n';
      md += '|----------|----------|------|------|------|\n';
      for (const fn of significantChanges.slice(0, 20)) {
        const location = fn.url
          ? `${path.basename(fn.url)}:${fn.line}`
          : '(native)';
        const diffStr = parseFloat(fn.diff) > 0 ? `+${fn.diff}` : fn.diff;
        md += `| ${fn.name} | ${location} | ${fn.pct1}% | ${fn.pct2}% | ${diffStr}% |\n`;
      }
    } else {
      md += '_No significant changes detected_\n';
    }

    return md;
  }
}

// Main execution
const args = process.argv.slice(2);
const profile1 = args[0];
const profile2 = args[1];

if (!profile1 || !profile2) {
  console.error('Usage: node compare-profiles.js <profile1.cpuprofile> <profile2.cpuprofile>');
  process.exit(1);
}

try {
  const comparator = new ProfileComparator(profile1, profile2);
  comparator.load();
  const report = comparator.compare();
  const markdown = comparator.formatMarkdown(report);
  console.log(markdown);
} catch (error) {
  console.error('Error comparing profiles:', error.message);
  process.exit(1);
}
