#!/usr/bin/env node

/**
 * V8 Heap Allocation Profile Analyzer
 * Analyzes .heapprofile files (sampling heap profiler)
 *
 * Usage:
 *   node analyze-heapprofile.js <heapprofile-file> [options]
 *
 * Options:
 *   --top=N    Show top N items (default: 50)
 *   --json     Output as JSON
 */

import fs from 'node:fs';
import path from 'node:path';

class HeapProfileAnalyzer {
  constructor(profilePath) {
    this.profilePath = profilePath;
    this.profile = null;
    this.allocations = [];
    this.totalSize = 0;
  }

  load() {
    const content = fs.readFileSync(this.profilePath, 'utf-8');
    this.profile = JSON.parse(content);
    this.processNode(this.profile.head, []);
    return this;
  }

  processNode(node, stack) {
    const frame = node.callFrame;
    const currentStack = [...stack, {
      functionName: frame.functionName || '(anonymous)',
      url: frame.url || '(native)',
      lineNumber: frame.lineNumber,
      columnNumber: frame.columnNumber,
    }];

    if (node.selfSize > 0) {
      this.allocations.push({
        size: node.selfSize,
        stack: currentStack,
      });
      this.totalSize += node.selfSize;
    }

    for (const child of (node.children || [])) {
      this.processNode(child, currentStack);
    }
  }

  /**
   * Get allocation by function
   */
  getAllocationByFunction() {
    const stats = new Map();

    for (const alloc of this.allocations) {
      // Get the leaf function (actual allocator)
      const leaf = alloc.stack[alloc.stack.length - 1];
      const key = `${leaf.functionName}|${leaf.url}|${leaf.lineNumber}`;

      if (!stats.has(key)) {
        stats.set(key, {
          functionName: leaf.functionName,
          url: leaf.url,
          lineNumber: leaf.lineNumber,
          totalSize: 0,
          count: 0,
        });
      }

      const stat = stats.get(key);
      stat.totalSize += alloc.size;
      stat.count++;
    }

    return Array.from(stats.values())
      .map(s => ({
        ...s,
        sizeMB: (s.totalSize / 1024 / 1024).toFixed(2),
        percentage: ((s.totalSize / this.totalSize) * 100).toFixed(2),
      }))
      .sort((a, b) => b.totalSize - a.totalSize);
  }

  /**
   * Get allocation by module
   */
  getAllocationByModule() {
    const stats = new Map();

    for (const alloc of this.allocations) {
      const leaf = alloc.stack[alloc.stack.length - 1];
      const url = leaf.url || '';

      let module = '(native/V8)';
      if (url.includes('node_modules')) {
        const match = url.match(/node_modules\/_?([^@/]+(?:@[^/]+)?@[^/]+|[^/]+)/);
        if (match) {
          module = match[1].replace(/@[0-9.]+@/, '@');
        }
      } else if (url.startsWith('node:')) {
        module = 'node:' + url.split('/')[0].replace('node:', '');
      } else if (url.includes('/application/')) {
        module = 'cnpmcore (app)';
      } else if (url) {
        module = path.basename(path.dirname(url)) || url;
      }

      if (!stats.has(module)) {
        stats.set(module, { totalSize: 0, count: 0, functions: new Set() });
      }

      const stat = stats.get(module);
      stat.totalSize += alloc.size;
      stat.count++;
      stat.functions.add(leaf.functionName);
    }

    return Array.from(stats.entries())
      .map(([name, stat]) => ({
        module: name,
        totalSize: stat.totalSize,
        sizeMB: (stat.totalSize / 1024 / 1024).toFixed(2),
        percentage: ((stat.totalSize / this.totalSize) * 100).toFixed(2),
        count: stat.count,
        functionCount: stat.functions.size,
      }))
      .sort((a, b) => b.totalSize - a.totalSize);
  }

  /**
   * Get top allocation call stacks
   */
  getTopAllocationStacks(limit = 20) {
    return this.allocations
      .sort((a, b) => b.size - a.size)
      .slice(0, limit)
      .map(alloc => ({
        size: alloc.size,
        sizeMB: (alloc.size / 1024 / 1024).toFixed(2),
        percentage: ((alloc.size / this.totalSize) * 100).toFixed(2),
        stack: alloc.stack.map(f => ({
          fn: f.functionName,
          file: f.url ? path.basename(f.url) : '(native)',
          line: f.lineNumber,
        })),
      }));
  }

  /**
   * Get cnpmcore-specific allocations
   */
  getCnpmcoreAllocations() {
    const categories = {
      'Leoric (ORM)': { pattern: /leoric/i, size: 0, count: 0, functions: [] },
      'MySQL Driver': { pattern: /mysql/i, size: 0, count: 0, functions: [] },
      'HTTP/Koa': { pattern: /koa|router|egg/i, size: 0, count: 0, functions: [] },
      'Buffer/Binary': { pattern: /buffer|uint8array/i, size: 0, count: 0, functions: [] },
      'String Operations': { pattern: /string|concat|slice/i, size: 0, count: 0, functions: [] },
      'JSON': { pattern: /json|parse|stringify/i, size: 0, count: 0, functions: [] },
      'App Code': { pattern: /\/application\//i, size: 0, count: 0, functions: [] },
    };

    for (const alloc of this.allocations) {
      const leaf = alloc.stack[alloc.stack.length - 1];
      const url = leaf.url || '';
      const fn = leaf.functionName || '';

      for (const [name, config] of Object.entries(categories)) {
        if (config.pattern.test(url) || config.pattern.test(fn)) {
          config.size += alloc.size;
          config.count++;
          if (!config.functions.includes(fn) && config.functions.length < 5) {
            config.functions.push(fn);
          }
          break;
        }
      }
    }

    return Object.entries(categories)
      .map(([name, stat]) => ({
        category: name,
        totalSize: stat.size,
        sizeMB: (stat.size / 1024 / 1024).toFixed(2),
        percentage: ((stat.size / this.totalSize) * 100).toFixed(2),
        count: stat.count,
        topFunctions: stat.functions,
      }))
      .filter(s => s.totalSize > 0)
      .sort((a, b) => b.totalSize - a.totalSize);
  }

  /**
   * Generate report
   */
  generateReport() {
    return {
      summary: {
        file: path.basename(this.profilePath),
        totalAllocations: this.allocations.length,
        totalSize: this.totalSize,
        totalSizeMB: (this.totalSize / 1024 / 1024).toFixed(2),
      },
      byModule: this.getAllocationByModule(),
      byFunction: this.getAllocationByFunction().slice(0, 50),
      topStacks: this.getTopAllocationStacks(15),
      cnpmcoreAnalysis: this.getCnpmcoreAllocations(),
    };
  }

  /**
   * Format as markdown
   */
  formatAsMarkdown(report) {
    let md = '# Heap Allocation Profile Analysis\n\n';
    md += `Generated: ${new Date().toISOString()}\n\n`;

    // Summary
    md += '## Summary\n\n';
    md += '| Metric | Value |\n';
    md += '|--------|-------|\n';
    md += `| File | ${report.summary.file} |\n`;
    md += `| Total Allocations | ${report.summary.totalAllocations.toLocaleString()} |\n`;
    md += `| Total Size | ${report.summary.totalSizeMB} MB |\n\n`;

    // By module
    md += '## Allocations by Module\n\n';
    md += '| Module | Size (MB) | % | Count |\n';
    md += '|--------|-----------|---|-------|\n';
    for (const stat of report.byModule.slice(0, 20)) {
      md += `| ${stat.module} | ${stat.sizeMB} | ${stat.percentage}% | ${stat.count} |\n`;
    }
    md += '\n';

    // cnpmcore analysis
    md += '## cnpmcore-Specific Allocations\n\n';
    md += '| Category | Size (MB) | % | Count | Top Functions |\n';
    md += '|----------|-----------|---|-------|---------------|\n';
    for (const stat of report.cnpmcoreAnalysis) {
      const fns = stat.topFunctions.slice(0, 3).join(', ') || '-';
      md += `| ${stat.category} | ${stat.sizeMB} | ${stat.percentage}% | ${stat.count} | ${fns} |\n`;
    }
    md += '\n';

    // Top functions
    md += '## Top 30 Allocating Functions\n\n';
    md += '| # | Function | Location | Size (MB) | % |\n';
    md += '|---|----------|----------|-----------|---|\n';
    for (let i = 0; i < Math.min(30, report.byFunction.length); i++) {
      const stat = report.byFunction[i];
      const location = stat.url
        ? `${path.basename(stat.url)}:${stat.lineNumber}`
        : '(native)';
      md += `| ${i + 1} | ${stat.functionName} | ${location} | ${stat.sizeMB} | ${stat.percentage}% |\n`;
    }
    md += '\n';

    // Top allocation stacks
    md += '## Top Allocation Call Stacks\n\n';
    for (let i = 0; i < Math.min(10, report.topStacks.length); i++) {
      const stack = report.topStacks[i];
      md += `### Stack ${i + 1} (${stack.sizeMB} MB, ${stack.percentage}%)\n\n`;
      md += '```\n';
      for (const frame of stack.stack.slice(-8)) {
        md += `  ${frame.fn} (${frame.file}:${frame.line})\n`;
      }
      md += '```\n\n';
    }

    return md;
  }
}

// Main execution
const args = process.argv.slice(2);
const profilePath = args.find(a => !a.startsWith('--'));
const asJson = args.includes('--json');

if (!profilePath) {
  console.error('Usage: node analyze-heapprofile.js <heapprofile-file> [--json]');
  process.exit(1);
}

try {
  const analyzer = new HeapProfileAnalyzer(profilePath);
  analyzer.load();

  const report = analyzer.generateReport();

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const markdown = analyzer.formatAsMarkdown(report);
    console.log(markdown);
  }
} catch (error) {
  console.error('Error analyzing heap profile:', error.message);
  process.exit(1);
}

export default HeapProfileAnalyzer;
