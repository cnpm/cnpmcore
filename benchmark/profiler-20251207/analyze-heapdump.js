#!/usr/bin/env node

/**
 * V8 Heapdump Analyzer for cnpmcore
 * Analyzes .heapsnapshot files and generates memory usage reports
 *
 * Usage:
 *   node analyze-heapdump.js <heapdump-file> [options]
 *
 * Options:
 *   --top=N          Show top N items (default: 50)
 *   --type=TYPE      Filter by object type
 *   --json           Output as JSON
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

class HeapdumpAnalyzer {
  constructor(heapdumpPath) {
    this.heapdumpPath = heapdumpPath;
    this.snapshot = null;
    this.nodeFields = [];
    this.nodeTypes = [];
    this.edgeFields = [];
    this.edgeTypes = [];
    this.strings = [];
    this.nodes = [];
    this.edges = [];
  }

  async load() {
    console.error('Loading heapdump file...');
    const content = fs.readFileSync(this.heapdumpPath, 'utf-8');
    console.error('Parsing JSON...');
    this.snapshot = JSON.parse(content);

    const meta = this.snapshot.snapshot.meta;
    this.nodeFields = meta.node_fields;
    this.nodeTypes = meta.node_types[0];
    this.edgeFields = meta.edge_fields;
    this.edgeTypes = meta.edge_types[0];

    this.strings = this.snapshot.strings || [];

    // Parse nodes
    console.error('Parsing nodes...');
    const nodeFieldCount = this.nodeFields.length;
    const rawNodes = this.snapshot.nodes;
    for (let i = 0; i < rawNodes.length; i += nodeFieldCount) {
      this.nodes.push({
        type: this.nodeTypes[rawNodes[i]],
        name: this.strings[rawNodes[i + 1]] || '',
        id: rawNodes[i + 2],
        selfSize: rawNodes[i + 3],
        edgeCount: rawNodes[i + 4],
        traceNodeId: rawNodes[i + 5],
        detachedness: rawNodes[i + 6],
      });
    }

    // Parse edges
    console.error('Parsing edges...');
    const edgeFieldCount = this.edgeFields.length;
    const rawEdges = this.snapshot.edges;
    for (let i = 0; i < rawEdges.length; i += edgeFieldCount) {
      this.edges.push({
        type: this.edgeTypes[rawEdges[i]],
        nameOrIndex: rawEdges[i + 1],
        toNode: rawEdges[i + 2] / nodeFieldCount,
      });
    }

    console.error(`Loaded ${this.nodes.length} nodes, ${this.edges.length} edges`);
    return this;
  }

  /**
   * Get memory usage by object type
   */
  getTypeStats() {
    const stats = new Map();

    for (const node of this.nodes) {
      const type = node.type;
      if (!stats.has(type)) {
        stats.set(type, { count: 0, selfSize: 0, retainedSize: 0 });
      }
      const stat = stats.get(type);
      stat.count++;
      stat.selfSize += node.selfSize;
    }

    return Array.from(stats.entries())
      .map(([type, stat]) => ({
        type,
        count: stat.count,
        selfSize: stat.selfSize,
        selfSizeMB: (stat.selfSize / 1024 / 1024).toFixed(2),
      }))
      .sort((a, b) => b.selfSize - a.selfSize);
  }

  /**
   * Get memory usage by constructor/class name
   */
  getConstructorStats() {
    const stats = new Map();

    for (const node of this.nodes) {
      if (node.type !== 'object' && node.type !== 'closure' && node.type !== 'array') {
        continue;
      }

      const name = node.name || '(anonymous)';
      if (!stats.has(name)) {
        stats.set(name, { count: 0, selfSize: 0 });
      }
      const stat = stats.get(name);
      stat.count++;
      stat.selfSize += node.selfSize;
    }

    return Array.from(stats.entries())
      .map(([name, stat]) => ({
        name,
        count: stat.count,
        selfSize: stat.selfSize,
        selfSizeMB: (stat.selfSize / 1024 / 1024).toFixed(2),
        avgSize: stat.count > 0 ? Math.round(stat.selfSize / stat.count) : 0,
      }))
      .sort((a, b) => b.selfSize - a.selfSize);
  }

  /**
   * Get string statistics
   */
  getStringStats() {
    const stringNodes = this.nodes.filter(n =>
      n.type === 'string' || n.type === 'concatenated string' || n.type === 'sliced string'
    );

    const totalSize = stringNodes.reduce((sum, n) => sum + n.selfSize, 0);
    const count = stringNodes.length;

    // Group by approximate length (size / 2 for UTF-16)
    const byLength = new Map();
    for (const node of stringNodes) {
      const approxLength = Math.floor(node.selfSize / 2);
      const bucket = approxLength < 100 ? '<100'
        : approxLength < 1000 ? '100-1K'
        : approxLength < 10000 ? '1K-10K'
        : approxLength < 100000 ? '10K-100K'
        : '>100K';

      if (!byLength.has(bucket)) {
        byLength.set(bucket, { count: 0, size: 0 });
      }
      const stat = byLength.get(bucket);
      stat.count++;
      stat.size += node.selfSize;
    }

    return {
      totalCount: count,
      totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      byLength: Array.from(byLength.entries()).map(([bucket, stat]) => ({
        bucket,
        count: stat.count,
        size: stat.size,
        sizeMB: (stat.size / 1024 / 1024).toFixed(2),
      })),
    };
  }

  /**
   * Get array statistics
   */
  getArrayStats() {
    const arrayNodes = this.nodes.filter(n => n.type === 'array');

    const totalSize = arrayNodes.reduce((sum, n) => sum + n.selfSize, 0);
    const count = arrayNodes.length;

    // Top arrays by size
    const topArrays = arrayNodes
      .sort((a, b) => b.selfSize - a.selfSize)
      .slice(0, 20)
      .map(n => ({
        name: n.name || '(anonymous)',
        size: n.selfSize,
        sizeMB: (n.selfSize / 1024 / 1024).toFixed(2),
        id: n.id,
      }));

    return {
      totalCount: count,
      totalSize,
      totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      topArrays,
    };
  }

  /**
   * Look for cnpmcore-specific patterns
   */
  getCnpmcoreStats() {
    const patterns = {
      'Bone instances': { pattern: /^Bone$|Model$/, count: 0, size: 0 },
      'Package entities': { pattern: /Package|Version|Dist/i, count: 0, size: 0 },
      'HTTP contexts': { pattern: /Context|Request|Response/i, count: 0, size: 0 },
      'Promises': { pattern: /^Promise$/, count: 0, size: 0 },
      'Maps': { pattern: /^Map$/, count: 0, size: 0 },
      'Sets': { pattern: /^Set$/, count: 0, size: 0 },
      'Buffers': { pattern: /Buffer|ArrayBuffer|Uint8Array/i, count: 0, size: 0 },
      'Closures': { pattern: null, type: 'closure', count: 0, size: 0 },
    };

    for (const node of this.nodes) {
      for (const [key, config] of Object.entries(patterns)) {
        if (config.type && node.type === config.type) {
          config.count++;
          config.size += node.selfSize;
        } else if (config.pattern && config.pattern.test(node.name)) {
          config.count++;
          config.size += node.selfSize;
        }
      }
    }

    return Object.entries(patterns).map(([name, stat]) => ({
      category: name,
      count: stat.count,
      size: stat.size,
      sizeMB: (stat.size / 1024 / 1024).toFixed(2),
    }));
  }

  /**
   * Get detached DOM nodes (memory leaks)
   */
  getDetachedNodes() {
    return this.nodes
      .filter(n => n.detachedness > 0)
      .sort((a, b) => b.selfSize - a.selfSize)
      .slice(0, 20)
      .map(n => ({
        type: n.type,
        name: n.name,
        size: n.selfSize,
        detachedness: n.detachedness,
      }));
  }

  /**
   * Generate comprehensive report
   */
  generateReport() {
    const totalSize = this.nodes.reduce((sum, n) => sum + n.selfSize, 0);

    return {
      summary: {
        file: path.basename(this.heapdumpPath),
        nodeCount: this.snapshot.snapshot.node_count,
        edgeCount: this.snapshot.snapshot.edge_count,
        totalSelfSize: totalSize,
        totalSelfSizeMB: (totalSize / 1024 / 1024).toFixed(2),
      },
      typeBreakdown: this.getTypeStats(),
      topConstructors: this.getConstructorStats().slice(0, 50),
      stringStats: this.getStringStats(),
      arrayStats: this.getArrayStats(),
      cnpmcorePatterns: this.getCnpmcoreStats(),
      detachedNodes: this.getDetachedNodes(),
    };
  }

  /**
   * Format report as markdown
   */
  formatAsMarkdown(report) {
    let md = '# Heapdump Analysis Report\n\n';
    md += `Generated: ${new Date().toISOString()}\n\n`;

    // Summary
    md += '## Summary\n\n';
    md += '| Metric | Value |\n';
    md += '|--------|-------|\n';
    md += `| File | ${report.summary.file} |\n`;
    md += `| Node Count | ${report.summary.nodeCount.toLocaleString()} |\n`;
    md += `| Edge Count | ${report.summary.edgeCount.toLocaleString()} |\n`;
    md += `| Total Self Size | ${report.summary.totalSelfSizeMB} MB |\n\n`;

    // Type breakdown
    md += '## Memory by Object Type\n\n';
    md += '| Type | Count | Self Size (MB) |\n';
    md += '|------|-------|----------------|\n';
    for (const stat of report.typeBreakdown) {
      md += `| ${stat.type} | ${stat.count.toLocaleString()} | ${stat.selfSizeMB} |\n`;
    }
    md += '\n';

    // cnpmcore patterns
    md += '## cnpmcore-Specific Memory Patterns\n\n';
    md += '| Category | Count | Size (MB) |\n';
    md += '|----------|-------|----------|\n';
    for (const stat of report.cnpmcorePatterns) {
      md += `| ${stat.category} | ${stat.count.toLocaleString()} | ${stat.sizeMB} |\n`;
    }
    md += '\n';

    // Top constructors
    md += '## Top 30 Constructors by Memory\n\n';
    md += '| # | Constructor | Count | Self Size (MB) | Avg Size |\n';
    md += '|---|-------------|-------|----------------|----------|\n';
    for (let i = 0; i < Math.min(30, report.topConstructors.length); i++) {
      const stat = report.topConstructors[i];
      md += `| ${i + 1} | ${stat.name} | ${stat.count.toLocaleString()} | ${stat.selfSizeMB} | ${stat.avgSize} |\n`;
    }
    md += '\n';

    // String stats
    md += '## String Memory Analysis\n\n';
    md += `- **Total Strings**: ${report.stringStats.totalCount.toLocaleString()}\n`;
    md += `- **Total Size**: ${report.stringStats.totalSizeMB} MB\n\n`;
    md += '| Length Bucket | Count | Size (MB) |\n';
    md += '|---------------|-------|----------|\n';
    for (const bucket of report.stringStats.byLength) {
      md += `| ${bucket.bucket} | ${bucket.count.toLocaleString()} | ${bucket.sizeMB} |\n`;
    }
    md += '\n';

    // Array stats
    md += '## Array Memory Analysis\n\n';
    md += `- **Total Arrays**: ${report.arrayStats.totalCount.toLocaleString()}\n`;
    md += `- **Total Size**: ${report.arrayStats.totalSizeMB} MB\n\n`;
    md += '### Top 10 Arrays by Size\n\n';
    md += '| Name | Size (MB) | ID |\n';
    md += '|------|-----------|----|\n';
    for (const arr of report.arrayStats.topArrays.slice(0, 10)) {
      md += `| ${arr.name} | ${arr.sizeMB} | ${arr.id} |\n`;
    }
    md += '\n';

    // Detached nodes
    if (report.detachedNodes.length > 0) {
      md += '## Potentially Leaked Objects (Detached)\n\n';
      md += '| Type | Name | Size |\n';
      md += '|------|------|------|\n';
      for (const node of report.detachedNodes) {
        md += `| ${node.type} | ${node.name} | ${node.size} |\n`;
      }
    }

    return md;
  }
}

// Main execution
const args = process.argv.slice(2);
const heapdumpPath = args.find(a => !a.startsWith('--'));
const asJson = args.includes('--json');

if (!heapdumpPath) {
  console.error('Usage: node analyze-heapdump.js <heapdump-file> [--json]');
  process.exit(1);
}

try {
  const analyzer = new HeapdumpAnalyzer(heapdumpPath);
  await analyzer.load();

  const report = analyzer.generateReport();

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const markdown = analyzer.formatAsMarkdown(report);
    console.log(markdown);
  }
} catch (error) {
  console.error('Error analyzing heapdump:', error.message);
  process.exit(1);
}

export default HeapdumpAnalyzer;
