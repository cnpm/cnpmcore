#!/usr/bin/env node

/**
 * CPU Profile Call Graph Analyzer
 * Generates call relationship diagrams for hotspot functions
 */

const fs = require('fs');
const path = require('path');

class CallGraphAnalyzer {
  constructor(profilePath) {
    this.profilePath = profilePath;
    this.profile = null;
    this.nodeMap = new Map();
    this.parentMap = new Map(); // child -> [parents]
    this.totalHitCount = 0;
  }

  load() {
    const content = fs.readFileSync(this.profilePath, 'utf-8');
    this.profile = JSON.parse(content);
    this._buildMaps();
    return this;
  }

  _buildMaps() {
    // Build node map
    for (const node of this.profile.nodes) {
      this.nodeMap.set(node.id, node);
      this.totalHitCount += node.hitCount;
    }

    // Build parent map (reverse relationship)
    for (const node of this.profile.nodes) {
      for (const childId of (node.children || [])) {
        if (!this.parentMap.has(childId)) {
          this.parentMap.set(childId, []);
        }
        this.parentMap.get(childId).push(node.id);
      }
    }
  }

  _getNodeLabel(node, short = false) {
    const funcName = node.callFrame.functionName || '(anonymous)';
    const url = node.callFrame.url || '';

    if (short) {
      return funcName;
    }

    let location = '';
    if (url) {
      // Simplify path
      let simplePath = url
        .replace(/.*node_modules\/_?/, '')
        .replace(/.*\/application\//, '')
        .replace('file://', '');

      // Further shorten
      if (simplePath.length > 50) {
        simplePath = '...' + simplePath.slice(-47);
      }
      location = `${simplePath}:${node.callFrame.lineNumber}`;
    }

    return location ? `${funcName}\n${location}` : funcName;
  }

  _getSimpleLabel(node) {
    const funcName = node.callFrame.functionName || '(anonymous)';
    const url = node.callFrame.url || '';

    let moduleName = '';
    if (url.includes('node_modules')) {
      const match = url.match(/node_modules\/_?([^@/]+(?:@[^/]+)?)/);
      if (match) moduleName = match[1].split('@')[0];
    } else if (url.includes('/application/app/')) {
      const match = url.match(/\/app\/([^/]+)/);
      if (match) moduleName = match[1];
    } else if (url.startsWith('node:')) {
      moduleName = 'node';
    }

    return moduleName ? `${moduleName}:${funcName}` : funcName;
  }

  /**
   * Find call paths to a hotspot function
   */
  findCallPaths(nodeId, maxDepth = 10) {
    const paths = [];
    const visited = new Set();

    const dfs = (currentId, path) => {
      if (path.length > maxDepth) return;
      if (visited.has(currentId)) return;

      visited.add(currentId);
      const node = this.nodeMap.get(currentId);
      if (!node) return;

      const parents = this.parentMap.get(currentId) || [];

      if (parents.length === 0 || path.length >= maxDepth) {
        // Reached root or max depth
        paths.push([...path, currentId]);
      } else {
        for (const parentId of parents) {
          dfs(parentId, [...path, currentId]);
        }
      }

      visited.delete(currentId);
    };

    dfs(nodeId, []);
    return paths;
  }

  /**
   * Get hotspot nodes (high self time, excluding idle/gc/program)
   */
  getHotspots(minSamples = 10) {
    const hotspots = [];
    const skipFunctions = ['(idle)', '(program)', '(root)', '(garbage collector)', 'runMicrotasks'];

    for (const node of this.profile.nodes) {
      if (node.hitCount < minSamples) continue;
      if (skipFunctions.includes(node.callFrame.functionName)) continue;

      hotspots.push({
        id: node.id,
        functionName: node.callFrame.functionName || '(anonymous)',
        url: node.callFrame.url || '',
        lineNumber: node.callFrame.lineNumber,
        selfTime: node.hitCount,
        selfTimePercent: (node.hitCount / this.totalHitCount * 100).toFixed(3),
      });
    }

    return hotspots.sort((a, b) => b.selfTime - a.selfTime);
  }

  /**
   * Build a subgraph around hotspots
   */
  buildHotspotGraph(minSamples = 15) {
    const hotspots = this.getHotspots(minSamples);
    const hotspotIds = new Set(hotspots.map(h => h.id));

    // Collect all relevant nodes (hotspots + their direct parents and children)
    const relevantNodes = new Set();
    const edges = [];

    for (const hotspot of hotspots) {
      relevantNodes.add(hotspot.id);

      const node = this.nodeMap.get(hotspot.id);

      // Add parents (callers)
      const parents = this.parentMap.get(hotspot.id) || [];
      for (const parentId of parents) {
        const parent = this.nodeMap.get(parentId);
        if (parent && parent.hitCount > 0) {
          relevantNodes.add(parentId);
          edges.push({ from: parentId, to: hotspot.id });
        }
      }

      // Add children (callees)
      for (const childId of (node.children || [])) {
        const child = this.nodeMap.get(childId);
        if (child && child.hitCount > 0) {
          relevantNodes.add(childId);
          edges.push({ from: hotspot.id, to: childId });
        }
      }
    }

    return { relevantNodes, edges, hotspotIds };
  }

  /**
   * Generate Mermaid diagram
   */
  generateMermaidDiagram(minSamples = 15) {
    const { relevantNodes, edges, hotspotIds } = this.buildHotspotGraph(minSamples);

    let mermaid = 'flowchart TD\n';
    mermaid += '    %% CPU Profile Call Graph - Hotspot Analysis\n\n';

    // Define node styles
    mermaid += '    %% Styling\n';
    mermaid += '    classDef hotspot fill:#ff6b6b,stroke:#c92a2a,color:#fff\n';
    mermaid += '    classDef caller fill:#4dabf7,stroke:#1971c2,color:#fff\n';
    mermaid += '    classDef callee fill:#69db7c,stroke:#2f9e44,color:#fff\n';
    mermaid += '    classDef native fill:#868e96,stroke:#495057,color:#fff\n\n';

    // Add nodes
    const nodeLabels = new Map();
    let nodeIndex = 0;

    for (const nodeId of relevantNodes) {
      const node = this.nodeMap.get(nodeId);
      if (!node) continue;

      const label = this._getSimpleLabel(node);
      const samples = node.hitCount;
      const percent = (samples / this.totalHitCount * 100).toFixed(2);

      const nodeKey = `N${nodeIndex++}`;
      nodeLabels.set(nodeId, nodeKey);

      // Escape special characters for mermaid
      const safeLabel = label.replace(/"/g, "'").replace(/[<>]/g, '');
      mermaid += `    ${nodeKey}["${safeLabel}<br/>${samples} (${percent}%)"]\n`;
    }

    mermaid += '\n    %% Edges\n';

    // Add edges
    const edgeSet = new Set();
    for (const edge of edges) {
      const fromKey = nodeLabels.get(edge.from);
      const toKey = nodeLabels.get(edge.to);
      if (fromKey && toKey) {
        const edgeKey = `${fromKey}-${toKey}`;
        if (!edgeSet.has(edgeKey)) {
          edgeSet.add(edgeKey);
          mermaid += `    ${fromKey} --> ${toKey}\n`;
        }
      }
    }

    mermaid += '\n    %% Apply styles\n';

    // Apply styles
    for (const nodeId of relevantNodes) {
      const nodeKey = nodeLabels.get(nodeId);
      const node = this.nodeMap.get(nodeId);
      if (!node || !nodeKey) continue;

      if (hotspotIds.has(nodeId)) {
        mermaid += `    class ${nodeKey} hotspot\n`;
      } else if (!node.callFrame.url) {
        mermaid += `    class ${nodeKey} native\n`;
      } else if (this.parentMap.get(nodeId)?.some(p => hotspotIds.has(p))) {
        mermaid += `    class ${nodeKey} callee\n`;
      } else {
        mermaid += `    class ${nodeKey} caller\n`;
      }
    }

    return mermaid;
  }

  /**
   * Generate text-based call tree
   */
  generateTextCallTree(minSamples = 20) {
    const hotspots = this.getHotspots(minSamples).slice(0, 15);
    let output = '';

    output += '=' .repeat(100) + '\n';
    output += 'HOTSPOT CALL RELATIONSHIPS\n';
    output += '=' .repeat(100) + '\n\n';

    output += 'Legend:\n';
    output += '  [HOT] = Hotspot function (high self time)\n';
    output += '  ← = Called by (parent/caller)\n';
    output += '  → = Calls (child/callee)\n';
    output += '\n';

    for (const hotspot of hotspots) {
      const node = this.nodeMap.get(hotspot.id);
      if (!node) continue;

      output += '-'.repeat(100) + '\n';
      output += `[HOT] ${hotspot.functionName} (${hotspot.selfTime} samples, ${hotspot.selfTimePercent}%)\n`;

      if (hotspot.url) {
        let loc = hotspot.url
          .replace(/.*node_modules\/_?/, 'node_modules/')
          .replace(/.*\/application\//, '');
        output += `      Location: ${loc}:${hotspot.lineNumber}\n`;
      }

      // Show callers (parents)
      const parents = this.parentMap.get(hotspot.id) || [];
      const significantParents = parents
        .map(pid => this.nodeMap.get(pid))
        .filter(p => p && p.hitCount > 0)
        .sort((a, b) => b.hitCount - a.hitCount)
        .slice(0, 5);

      if (significantParents.length > 0) {
        output += '\n      Called by:\n';
        for (const parent of significantParents) {
          const pLabel = this._getSimpleLabel(parent);
          output += `        ← ${pLabel} (${parent.hitCount} samples)\n`;
        }
      }

      // Show callees (children)
      const children = (node.children || [])
        .map(cid => this.nodeMap.get(cid))
        .filter(c => c && c.hitCount > 0)
        .sort((a, b) => b.hitCount - a.hitCount)
        .slice(0, 5);

      if (children.length > 0) {
        output += '\n      Calls:\n';
        for (const child of children) {
          const cLabel = this._getSimpleLabel(child);
          output += `        → ${cLabel} (${child.hitCount} samples)\n`;
        }
      }

      output += '\n';
    }

    return output;
  }

  /**
   * Generate focused call chains for specific categories
   */
  generateCategoryCallChains() {
    let output = '';

    output += '=' .repeat(100) + '\n';
    output += 'CALL CHAINS BY CATEGORY\n';
    output += '=' .repeat(100) + '\n\n';

    // Find key entry points and their chains
    const categories = [
      { name: 'ORM (leoric)', pattern: /leoric/ },
      { name: 'MySQL', pattern: /mysql2/ },
      { name: 'HTTP Client', pattern: /urllib|undici/ },
      { name: 'Application Code', pattern: /\/application\/app\// },
      { name: 'Tegg Runtime', pattern: /tegg-runtime/ },
    ];

    for (const category of categories) {
      const categoryNodes = [];

      for (const node of this.profile.nodes) {
        if (node.hitCount < 5) continue;
        const url = node.callFrame.url || '';
        if (category.pattern.test(url)) {
          categoryNodes.push(node);
        }
      }

      if (categoryNodes.length === 0) continue;

      // Sort by hit count
      categoryNodes.sort((a, b) => b.hitCount - a.hitCount);

      output += `----- ${category.name} -----\n\n`;

      // Show top functions in this category with their call context
      for (const node of categoryNodes.slice(0, 5)) {
        const funcName = node.callFrame.functionName || '(anonymous)';
        const samples = node.hitCount;
        const percent = (samples / this.totalHitCount * 100).toFixed(3);

        output += `  ${funcName} (${samples} samples, ${percent}%)\n`;

        // Build a sample call stack
        const stack = this._buildSampleCallStack(node.id, 8);
        if (stack.length > 1) {
          output += '    Call stack:\n';
          for (let i = stack.length - 1; i >= 0; i--) {
            const stackNode = stack[i];
            const indent = '    ' + '  '.repeat(stack.length - 1 - i);
            const marker = i === 0 ? '→ ' : '  ';
            output += `${indent}${marker}${this._getSimpleLabel(stackNode)}\n`;
          }
        }
        output += '\n';
      }
    }

    return output;
  }

  _buildSampleCallStack(nodeId, maxDepth) {
    const stack = [];
    let currentId = nodeId;

    while (stack.length < maxDepth && currentId) {
      const node = this.nodeMap.get(currentId);
      if (!node) break;

      stack.push(node);

      // Get the most significant parent
      const parents = this.parentMap.get(currentId) || [];
      if (parents.length === 0) break;

      // Choose parent with highest hit count
      let bestParent = null;
      let bestHitCount = 0;
      for (const parentId of parents) {
        const parent = this.nodeMap.get(parentId);
        if (parent && parent.hitCount > bestHitCount) {
          bestHitCount = parent.hitCount;
          bestParent = parentId;
        }
      }

      currentId = bestParent;
    }

    return stack;
  }
}

// Main execution
function main() {
  const args = process.argv.slice(2);
  const profilePath = args[0] || path.join(
    process.env.HOME,
    'Downloads/cnpmcore/4.16.0/x-cpuprofile-3642061-20251213-0.cpuprofile'
  );

  if (!fs.existsSync(profilePath)) {
    console.error(`Profile file not found: ${profilePath}`);
    process.exit(1);
  }

  console.log(`Analyzing call graph: ${profilePath}\n`);

  const analyzer = new CallGraphAnalyzer(profilePath);
  analyzer.load();

  // Generate text call tree
  const textTree = analyzer.generateTextCallTree(15);
  console.log(textTree);

  // Generate category chains
  const categoryChains = analyzer.generateCategoryCallChains();
  console.log(categoryChains);

  // Generate Mermaid diagram
  const mermaid = analyzer.generateMermaidDiagram(20);

  // Save Mermaid diagram
  const mermaidPath = path.join(__dirname, 'call-graph.mmd');
  fs.writeFileSync(mermaidPath, mermaid);
  console.log(`\nMermaid diagram saved to: ${mermaidPath}`);

  // Save full text report
  const textReportPath = path.join(__dirname, 'call-relationships.txt');
  fs.writeFileSync(textReportPath, textTree + '\n' + categoryChains);
  console.log(`Text report saved to: ${textReportPath}`);

  return { textTree, categoryChains, mermaid };
}

if (require.main === module) {
  main();
}

module.exports = { CallGraphAnalyzer };
