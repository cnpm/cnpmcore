#!/usr/bin/env node

/**
 * CPU Profile Analyzer for cnpmcore
 * Analyzes V8 CPU profile files (.cpuprofile) and generates reports
 */

const fs = require('fs');
const path = require('path');

class CpuProfileAnalyzer {
  constructor(profilePath) {
    this.profilePath = profilePath;
    this.profile = null;
    this.nodeMap = new Map();
    this.totalHitCount = 0;
    this.idleHitCount = 0;
    this.programHitCount = 0;
    this.gcHitCount = 0;
  }

  load() {
    const content = fs.readFileSync(this.profilePath, 'utf-8');
    this.profile = JSON.parse(content);
    this._buildNodeMap();
    this._calculateTotals();
    return this;
  }

  _buildNodeMap() {
    for (const node of this.profile.nodes) {
      this.nodeMap.set(node.id, node);
    }
  }

  _calculateTotals() {
    for (const node of this.profile.nodes) {
      this.totalHitCount += node.hitCount;

      const funcName = node.callFrame.functionName;
      if (funcName === '(idle)') {
        this.idleHitCount += node.hitCount;
      } else if (funcName === '(program)') {
        this.programHitCount += node.hitCount;
      } else if (funcName === '(garbage collector)') {
        this.gcHitCount += node.hitCount;
      }
    }
  }

  /**
   * Get self time for each node (excluding children)
   */
  getSelfTimeStats() {
    const stats = [];

    for (const node of this.profile.nodes) {
      if (node.hitCount === 0) continue;

      const { callFrame } = node;
      const funcName = callFrame.functionName || '(anonymous)';
      const url = callFrame.url || '';
      const lineNumber = callFrame.lineNumber || 0;

      stats.push({
        id: node.id,
        functionName: funcName,
        url,
        lineNumber,
        selfTime: node.hitCount,
        selfTimePercent: (node.hitCount / this.totalHitCount * 100).toFixed(2),
      });
    }

    return stats.sort((a, b) => b.selfTime - a.selfTime);
  }

  /**
   * Calculate total time (including children) for each node
   */
  getTotalTimeStats() {
    const totalTimes = new Map();

    const calculateTotal = (nodeId, visited = new Set()) => {
      if (visited.has(nodeId)) return 0;
      visited.add(nodeId);

      const node = this.nodeMap.get(nodeId);
      if (!node) return 0;

      let total = node.hitCount;
      for (const childId of (node.children || [])) {
        total += calculateTotal(childId, visited);
      }

      return total;
    };

    for (const node of this.profile.nodes) {
      const totalTime = calculateTotal(node.id, new Set());
      if (totalTime > 0) {
        totalTimes.set(node.id, {
          id: node.id,
          functionName: node.callFrame.functionName || '(anonymous)',
          url: node.callFrame.url || '',
          lineNumber: node.callFrame.lineNumber || 0,
          totalTime,
          totalTimePercent: (totalTime / this.totalHitCount * 100).toFixed(2),
          selfTime: node.hitCount,
        });
      }
    }

    return Array.from(totalTimes.values()).sort((a, b) => b.totalTime - a.totalTime);
  }

  /**
   * Group by file/module
   */
  getModuleStats() {
    const moduleStats = new Map();

    for (const node of this.profile.nodes) {
      if (node.hitCount === 0) continue;

      let url = node.callFrame.url || '';
      if (!url) continue;

      // Normalize the url
      let moduleName = url;
      if (url.includes('node_modules')) {
        // Extract package name from node_modules
        const match = url.match(/node_modules\/_?([^@/]+(?:@[^/]+)?@[^/]+|[^/]+)/);
        if (match) {
          moduleName = `node_modules/${match[1]}`;
        }
      } else if (url.startsWith('node:')) {
        moduleName = url;
      } else if (url.includes('/application/')) {
        // Application code
        const match = url.match(/\/application\/(.+)/);
        if (match) {
          moduleName = match[1];
        }
      }

      if (!moduleStats.has(moduleName)) {
        moduleStats.set(moduleName, {
          moduleName,
          selfTime: 0,
          functions: new Map(),
        });
      }

      const stat = moduleStats.get(moduleName);
      stat.selfTime += node.hitCount;

      const funcName = node.callFrame.functionName || '(anonymous)';
      const funcKey = `${funcName}:${node.callFrame.lineNumber}`;
      if (!stat.functions.has(funcKey)) {
        stat.functions.set(funcKey, {
          functionName: funcName,
          lineNumber: node.callFrame.lineNumber,
          selfTime: 0,
        });
      }
      stat.functions.get(funcKey).selfTime += node.hitCount;
    }

    // Convert functions map to sorted array
    for (const stat of moduleStats.values()) {
      stat.functions = Array.from(stat.functions.values())
        .sort((a, b) => b.selfTime - a.selfTime)
        .slice(0, 10);
      stat.selfTimePercent = (stat.selfTime / this.totalHitCount * 100).toFixed(2);
    }

    return Array.from(moduleStats.values())
      .sort((a, b) => b.selfTime - a.selfTime);
  }

  /**
   * Get cnpmcore specific stats
   */
  getCnpmcoreStats() {
    const stats = {
      controllers: [],
      services: [],
      repositories: [],
      models: [],
      others: [],
    };

    for (const node of this.profile.nodes) {
      if (node.hitCount === 0) continue;

      const url = node.callFrame.url || '';
      if (!url.includes('/application/') && !url.includes('cnpmcore')) continue;

      const funcName = node.callFrame.functionName || '(anonymous)';
      const entry = {
        functionName: funcName,
        url: url.replace(/.*\/application\//, ''),
        lineNumber: node.callFrame.lineNumber,
        selfTime: node.hitCount,
        selfTimePercent: (node.hitCount / this.totalHitCount * 100).toFixed(4),
      };

      if (url.includes('controller')) {
        stats.controllers.push(entry);
      } else if (url.includes('service')) {
        stats.services.push(entry);
      } else if (url.includes('repository')) {
        stats.repositories.push(entry);
      } else if (url.includes('model')) {
        stats.models.push(entry);
      } else {
        stats.others.push(entry);
      }
    }

    // Sort each category
    for (const key of Object.keys(stats)) {
      stats[key] = stats[key].sort((a, b) => b.selfTime - a.selfTime).slice(0, 20);
    }

    return stats;
  }

  /**
   * Generate summary report
   */
  getSummary() {
    const activeTime = this.totalHitCount - this.idleHitCount;

    return {
      profileTitle: this.profile.title || 'Unknown',
      totalNodes: this.profile.nodes.length,
      totalSamples: this.totalHitCount,
      idleSamples: this.idleHitCount,
      idlePercent: (this.idleHitCount / this.totalHitCount * 100).toFixed(2),
      activeSamples: activeTime,
      activePercent: (activeTime / this.totalHitCount * 100).toFixed(2),
      gcSamples: this.gcHitCount,
      gcPercent: (this.gcHitCount / this.totalHitCount * 100).toFixed(2),
      programSamples: this.programHitCount,
      programPercent: (this.programHitCount / this.totalHitCount * 100).toFixed(2),
    };
  }

  /**
   * Generate full report
   */
  generateReport() {
    const summary = this.getSummary();
    const selfTimeStats = this.getSelfTimeStats();
    const moduleStats = this.getModuleStats();
    const cnpmcoreStats = this.getCnpmcoreStats();

    return {
      summary,
      topFunctionsBySelfTime: selfTimeStats.slice(0, 50),
      moduleStats: moduleStats.slice(0, 30),
      cnpmcoreStats,
    };
  }
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  const profilePath = args[0] || path.join(__dirname, '../../..', 'Downloads/cnpmcore/4.16.0/x-cpuprofile-3642061-20251213-0.cpuprofile');

  if (!fs.existsSync(profilePath)) {
    console.error(`Profile file not found: ${profilePath}`);
    process.exit(1);
  }

  console.log(`Analyzing CPU profile: ${profilePath}\n`);

  const analyzer = new CpuProfileAnalyzer(profilePath);
  analyzer.load();

  const report = analyzer.generateReport();

  // Print Summary
  console.log('=' .repeat(80));
  console.log('CPU PROFILE ANALYSIS SUMMARY');
  console.log('=' .repeat(80));
  console.log(`Profile Title: ${report.summary.profileTitle}`);
  console.log(`Total Nodes: ${report.summary.totalNodes}`);
  console.log(`Total Samples: ${report.summary.totalSamples}`);
  console.log(`\nTime Distribution:`);
  console.log(`  Idle:    ${report.summary.idleSamples} (${report.summary.idlePercent}%)`);
  console.log(`  Active:  ${report.summary.activeSamples} (${report.summary.activePercent}%)`);
  console.log(`  GC:      ${report.summary.gcSamples} (${report.summary.gcPercent}%)`);
  console.log(`  Program: ${report.summary.programSamples} (${report.summary.programPercent}%)`);

  // Print Top Functions by Self Time
  console.log('\n' + '=' .repeat(80));
  console.log('TOP 30 FUNCTIONS BY SELF TIME (excluding idle)');
  console.log('=' .repeat(80));

  const nonIdleFunctions = report.topFunctionsBySelfTime
    .filter(f => !['(idle)', '(program)', '(root)'].includes(f.functionName));

  console.log(`${'Rank'.padStart(4)} | ${'Self %'.padStart(7)} | ${'Samples'.padStart(10)} | Function`);
  console.log('-'.repeat(80));

  nonIdleFunctions.slice(0, 30).forEach((func, i) => {
    const location = func.url ? `${func.url}:${func.lineNumber}` : '(native)';
    console.log(
      `${String(i + 1).padStart(4)} | ${func.selfTimePercent.padStart(7)}% | ${String(func.selfTime).padStart(10)} | ${func.functionName}`
    );
    console.log(`${''.padStart(4)}   ${''.padStart(7)}   ${''.padStart(10)}   ${location}`);
  });

  // Print Module Stats
  console.log('\n' + '=' .repeat(80));
  console.log('TOP 20 MODULES BY SELF TIME');
  console.log('=' .repeat(80));

  console.log(`${'Rank'.padStart(4)} | ${'Self %'.padStart(7)} | ${'Samples'.padStart(10)} | Module`);
  console.log('-'.repeat(80));

  report.moduleStats.slice(0, 20).forEach((mod, i) => {
    console.log(
      `${String(i + 1).padStart(4)} | ${mod.selfTimePercent.padStart(7)}% | ${String(mod.selfTime).padStart(10)} | ${mod.moduleName}`
    );
    if (mod.functions.length > 0) {
      mod.functions.slice(0, 3).forEach(func => {
        console.log(`${''.padStart(4)}   ${''.padStart(7)}   ${''.padStart(10)}     └─ ${func.functionName}:${func.lineNumber} (${func.selfTime})`);
      });
    }
  });

  // Print cnpmcore Stats
  console.log('\n' + '=' .repeat(80));
  console.log('CNPMCORE APPLICATION CODE ANALYSIS');
  console.log('=' .repeat(80));

  const printCnpmcoreSection = (title, items) => {
    if (items.length === 0) return;
    console.log(`\n${title}:`);
    console.log('-'.repeat(60));
    items.slice(0, 10).forEach(item => {
      console.log(`  ${item.functionName} (${item.selfTimePercent}%, ${item.selfTime} samples)`);
      console.log(`    ${item.url}:${item.lineNumber}`);
    });
  };

  printCnpmcoreSection('Controllers', report.cnpmcoreStats.controllers);
  printCnpmcoreSection('Services', report.cnpmcoreStats.services);
  printCnpmcoreSection('Repositories', report.cnpmcoreStats.repositories);
  printCnpmcoreSection('Models', report.cnpmcoreStats.models);
  printCnpmcoreSection('Others', report.cnpmcoreStats.others);

  // Save JSON report
  const reportPath = path.join(__dirname, 'analysis-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n\nFull report saved to: ${reportPath}`);

  return report;
}

if (require.main === module) {
  main();
}

module.exports = { CpuProfileAnalyzer };
