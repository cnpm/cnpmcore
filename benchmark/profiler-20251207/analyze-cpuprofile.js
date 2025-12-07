#!/usr/bin/env node

/**
 * CPU Profile Analyzer for cnpmcore
 * Analyzes V8/xprofiler CPU profiles and generates performance reports
 *
 * Usage:
 *   node analyze-cpuprofile.js <profile.cpuprofile> [options]
 *
 * Options:
 *   --top=N          Show top N functions (default: 50)
 *   --filter=PATTERN Filter functions by pattern
 *   --json           Output as JSON
 *   --cnpmcore       Focus on cnpmcore application code
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class CPUProfileAnalyzer {
  constructor(profilePath) {
    this.profilePath = profilePath;
    this.profile = null;
    this.nodeMap = new Map();
    this.totalSamples = 0;
    this.totalHits = 0;
  }

  load() {
    const content = fs.readFileSync(this.profilePath, 'utf-8');
    this.profile = JSON.parse(content);
    this.buildNodeMap();
    return this;
  }

  buildNodeMap() {
    for (const node of this.profile.nodes) {
      this.nodeMap.set(node.id, node);
      this.totalHits += node.hitCount || 0;
    }
    this.totalSamples = this.profile.samples?.length || this.totalHits;
  }

  /**
   * Get self time for each function (direct CPU usage)
   */
  getSelfTimeStats() {
    const stats = new Map();

    for (const node of this.profile.nodes) {
      const frame = node.callFrame;
      const key = `${frame.functionName}|${frame.url}|${frame.lineNumber}`;

      if (!stats.has(key)) {
        stats.set(key, {
          functionName: frame.functionName || '(anonymous)',
          url: frame.url || '(native)',
          lineNumber: frame.lineNumber,
          columnNumber: frame.columnNumber,
          hitCount: 0,
          selfTime: 0,
          nodeIds: [],
        });
      }

      const stat = stats.get(key);
      stat.hitCount += node.hitCount || 0;
      stat.nodeIds.push(node.id);
    }

    // Calculate percentage
    for (const stat of stats.values()) {
      stat.percentage = this.totalHits > 0
        ? ((stat.hitCount / this.totalHits) * 100).toFixed(2)
        : '0.00';
    }

    return Array.from(stats.values())
      .filter(s => s.hitCount > 0)
      .sort((a, b) => b.hitCount - a.hitCount);
  }

  /**
   * Get total time including children (inclusive time)
   */
  getTotalTimeStats() {
    const inclusiveHits = new Map();

    // Calculate inclusive time using DFS
    const calculateInclusive = (nodeId, visited = new Set()) => {
      if (visited.has(nodeId)) return 0;
      visited.add(nodeId);

      const node = this.nodeMap.get(nodeId);
      if (!node) return 0;

      let total = node.hitCount || 0;
      for (const childId of (node.children || [])) {
        total += calculateInclusive(childId, visited);
      }
      return total;
    };

    for (const node of this.profile.nodes) {
      const frame = node.callFrame;
      const key = `${frame.functionName}|${frame.url}|${frame.lineNumber}`;

      if (!inclusiveHits.has(key)) {
        inclusiveHits.set(key, {
          functionName: frame.functionName || '(anonymous)',
          url: frame.url || '(native)',
          lineNumber: frame.lineNumber,
          columnNumber: frame.columnNumber,
          inclusiveHits: 0,
          nodeIds: [],
        });
      }

      const stat = inclusiveHits.get(key);
      stat.inclusiveHits += calculateInclusive(node.id);
      stat.nodeIds.push(node.id);
    }

    for (const stat of inclusiveHits.values()) {
      stat.percentage = this.totalHits > 0
        ? ((stat.inclusiveHits / this.totalHits) * 100).toFixed(2)
        : '0.00';
    }

    return Array.from(inclusiveHits.values())
      .filter(s => s.inclusiveHits > 0)
      .sort((a, b) => b.inclusiveHits - a.inclusiveHits);
  }

  /**
   * Categorize by module/package
   */
  getModuleStats() {
    const moduleStats = new Map();

    for (const node of this.profile.nodes) {
      const frame = node.callFrame;
      const url = frame.url || '';

      let module = '(native/gc)';
      if (url.includes('node_modules')) {
        // Extract package name from node_modules path
        const match = url.match(/node_modules\/_?([^@/]+(?:@[^/]+)?@[^/]+|[^/]+)/);
        if (match) {
          module = match[1].replace(/@[0-9.]+@/, '@'); // Clean up version
        } else {
          module = 'node_modules (unknown)';
        }
      } else if (url.startsWith('node:')) {
        module = 'node:' + url.split('/')[0].replace('node:', '');
      } else if (url.includes('/application/')) {
        module = 'cnpmcore (app)';
      } else if (url) {
        module = path.basename(path.dirname(url)) || url;
      }

      if (!moduleStats.has(module)) {
        moduleStats.set(module, { hitCount: 0, functions: new Set() });
      }

      const stat = moduleStats.get(module);
      stat.hitCount += node.hitCount || 0;
      stat.functions.add(frame.functionName || '(anonymous)');
    }

    return Array.from(moduleStats.entries())
      .map(([name, stat]) => ({
        module: name,
        hitCount: stat.hitCount,
        percentage: this.totalHits > 0
          ? ((stat.hitCount / this.totalHits) * 100).toFixed(2)
          : '0.00',
        functionCount: stat.functions.size,
      }))
      .filter(s => s.hitCount > 0)
      .sort((a, b) => b.hitCount - a.hitCount);
  }

  /**
   * Get cnpmcore application-specific stats
   */
  getCnpmcoreStats() {
    const categories = {
      'Leoric (ORM)': [],
      'MySQL Driver': [],
      'HTTP/Router': [],
      'JSON Processing': [],
      'Compression': [],
      'Validation': [],
      'Entity/Service': [],
      'Controller': [],
      'Other App Code': [],
    };

    const selfStats = this.getSelfTimeStats();

    for (const stat of selfStats) {
      const url = stat.url.toLowerCase();
      const fn = stat.functionName.toLowerCase();

      if (url.includes('leoric')) {
        categories['Leoric (ORM)'].push(stat);
      } else if (url.includes('mysql') || url.includes('mariadb')) {
        categories['MySQL Driver'].push(stat);
      } else if (url.includes('koa') || url.includes('router') || url.includes('egg')) {
        categories['HTTP/Router'].push(stat);
      } else if (fn.includes('json') || fn.includes('stringify') || fn.includes('parse')) {
        categories['JSON Processing'].push(stat);
      } else if (url.includes('zlib') || url.includes('compress') || fn.includes('compress')) {
        categories['Compression'].push(stat);
      } else if (url.includes('typebox') || url.includes('ajv') || url.includes('valid')) {
        categories['Validation'].push(stat);
      } else if (url.includes('/entity/') || url.includes('/service/')) {
        categories['Entity/Service'].push(stat);
      } else if (url.includes('/controller/')) {
        categories['Controller'].push(stat);
      } else if (url.includes('/application/')) {
        categories['Other App Code'].push(stat);
      }
    }

    const summary = {};
    for (const [category, stats] of Object.entries(categories)) {
      const totalHits = stats.reduce((sum, s) => sum + s.hitCount, 0);
      summary[category] = {
        hitCount: totalHits,
        percentage: this.totalHits > 0
          ? ((totalHits / this.totalHits) * 100).toFixed(2)
          : '0.00',
        topFunctions: stats.slice(0, 5).map(s => ({
          name: s.functionName,
          url: s.url,
          line: s.lineNumber,
          hits: s.hitCount,
        })),
      };
    }

    return summary;
  }

  /**
   * Get hot paths (call stacks that consume most CPU)
   */
  getHotPaths(maxDepth = 10, minHits = 100) {
    const paths = [];

    const buildPath = (nodeId, currentPath = [], depth = 0) => {
      if (depth > maxDepth) return;

      const node = this.nodeMap.get(nodeId);
      if (!node) return;

      const frame = node.callFrame;
      const pathEntry = {
        fn: frame.functionName || '(anonymous)',
        url: frame.url ? path.basename(frame.url) : '(native)',
        line: frame.lineNumber,
        hits: node.hitCount,
      };

      const newPath = [...currentPath, pathEntry];

      if (node.hitCount >= minHits) {
        paths.push({
          stack: newPath,
          hits: node.hitCount,
        });
      }

      for (const childId of (node.children || [])) {
        buildPath(childId, newPath, depth + 1);
      }
    };

    // Start from root
    const rootNode = this.profile.nodes[0];
    if (rootNode) {
      for (const childId of (rootNode.children || [])) {
        buildPath(childId, []);
      }
    }

    return paths
      .sort((a, b) => b.hits - a.hits)
      .slice(0, 20);
  }

  /**
   * Generate comprehensive report
   */
  generateReport() {
    const selfStats = this.getSelfTimeStats();
    const moduleStats = this.getModuleStats();
    const cnpmcoreStats = this.getCnpmcoreStats();
    const hotPaths = this.getHotPaths();

    return {
      summary: {
        profileFile: path.basename(this.profilePath),
        totalNodes: this.profile.nodes.length,
        totalHits: this.totalHits,
        totalSamples: this.totalSamples,
        profileType: this.profile.typeId,
      },
      topFunctionsBySelfTime: selfStats.slice(0, 50),
      moduleBreakdown: moduleStats,
      cnpmcoreAnalysis: cnpmcoreStats,
      hotPaths: hotPaths,
    };
  }

  /**
   * Format report as markdown
   */
  formatAsMarkdown(report) {
    let md = '# CPU Profile Analysis Report\n\n';
    md += `Generated: ${new Date().toISOString()}\n\n`;

    // Summary
    md += '## Summary\n\n';
    md += `| Metric | Value |\n`;
    md += `|--------|-------|\n`;
    md += `| Profile File | ${report.summary.profileFile} |\n`;
    md += `| Total Nodes | ${report.summary.totalNodes} |\n`;
    md += `| Total Hits | ${report.summary.totalHits} |\n`;
    md += `| Profile Type | ${report.summary.profileType} |\n\n`;

    // Module breakdown
    md += '## Module Breakdown\n\n';
    md += '| Module | Hits | % | Functions |\n';
    md += '|--------|------|---|----------|\n';
    for (const stat of report.moduleBreakdown.slice(0, 20)) {
      md += `| ${stat.module} | ${stat.hitCount} | ${stat.percentage}% | ${stat.functionCount} |\n`;
    }
    md += '\n';

    // cnpmcore Analysis
    md += '## cnpmcore Application Analysis\n\n';
    for (const [category, data] of Object.entries(report.cnpmcoreAnalysis)) {
      if (data.hitCount > 0) {
        md += `### ${category}\n\n`;
        md += `- **Total Hits**: ${data.hitCount} (${data.percentage}%)\n`;
        if (data.topFunctions.length > 0) {
          md += '- **Top Functions**:\n';
          for (const fn of data.topFunctions) {
            md += `  - \`${fn.name}\` in ${fn.url}:${fn.line} (${fn.hits} hits)\n`;
          }
        }
        md += '\n';
      }
    }

    // Top functions
    md += '## Top 30 Functions by Self Time\n\n';
    md += '| # | Function | Location | Hits | % |\n';
    md += '|---|----------|----------|------|---|\n';
    for (let i = 0; i < Math.min(30, report.topFunctionsBySelfTime.length); i++) {
      const stat = report.topFunctionsBySelfTime[i];
      const location = stat.url
        ? `${path.basename(stat.url)}:${stat.lineNumber}`
        : '(native)';
      md += `| ${i + 1} | ${stat.functionName} | ${location} | ${stat.hitCount} | ${stat.percentage}% |\n`;
    }
    md += '\n';

    // Hot paths
    md += '## Hot Paths (Top CPU Consuming Call Stacks)\n\n';
    for (let i = 0; i < Math.min(10, report.hotPaths.length); i++) {
      const pathInfo = report.hotPaths[i];
      md += `### Path ${i + 1} (${pathInfo.hits} hits)\n\n`;
      md += '```\n';
      for (const frame of pathInfo.stack) {
        md += `  ${frame.fn} (${frame.url}:${frame.line})\n`;
      }
      md += '```\n\n';
    }

    return md;
  }
}

// Main execution
const args = process.argv.slice(2);
const profilePath = args.find(a => !a.startsWith('--'));
const topN = parseInt(args.find(a => a.startsWith('--top='))?.split('=')[1] || '50');
const asJson = args.includes('--json');
const filter = args.find(a => a.startsWith('--filter='))?.split('=')[1];

if (!profilePath) {
  console.error('Usage: node analyze-cpuprofile.js <profile.cpuprofile> [--top=N] [--json] [--filter=PATTERN]');
  process.exit(1);
}

try {
  const analyzer = new CPUProfileAnalyzer(profilePath);
  analyzer.load();

  const report = analyzer.generateReport();

  if (filter) {
    const regex = new RegExp(filter, 'i');
    report.topFunctionsBySelfTime = report.topFunctionsBySelfTime.filter(
      s => regex.test(s.functionName) || regex.test(s.url)
    );
  }

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const markdown = analyzer.formatAsMarkdown(report);
    console.log(markdown);
  }
} catch (error) {
  console.error('Error analyzing profile:', error.message);
  process.exit(1);
}

export default CPUProfileAnalyzer;
