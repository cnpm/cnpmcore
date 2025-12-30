#!/usr/bin/env node

/**
 * Generate call relationship diagrams for cnpmcore CPU profile hotspots
 */

import fs from 'node:fs';
import path from 'node:path';

const PROFILE_DIR = process.env.PROFILE_DIR || path.join(process.env.HOME, 'Downloads/cnpmcore/4.18.0');
const OUTPUT_DIR = process.env.OUTPUT_DIR || path.dirname(new URL(import.meta.url).pathname);

class CallGraphGenerator {
  constructor(profilePath) {
    this.profilePath = profilePath;
    this.profile = null;
    this.nodeMap = new Map();
    this.parentMap = new Map(); // child -> parents
  }

  load() {
    const content = fs.readFileSync(this.profilePath, 'utf-8');
    this.profile = JSON.parse(content);

    // Build node map and parent map
    for (const node of this.profile.nodes) {
      this.nodeMap.set(node.id, node);

      // Build reverse mapping (child -> parent)
      for (const childId of node.children || []) {
        if (!this.parentMap.has(childId)) {
          this.parentMap.set(childId, []);
        }
        this.parentMap.get(childId).push(node.id);
      }
    }

    return this;
  }

  /**
   * Find a node by function name (returns first match)
   */
  findNodeByName(functionName) {
    for (const node of this.profile.nodes) {
      if (node.callFrame.functionName === functionName) {
        return node;
      }
    }
    return null;
  }

  /**
   * Find all nodes by function name
   */
  findAllNodesByName(functionName) {
    return this.profile.nodes.filter((n) => n.callFrame.functionName === functionName);
  }

  /**
   * Get callers chain (who called this function)
   */
  getCallersChain(nodeId, depth = 5, visited = new Set()) {
    if (depth === 0 || visited.has(nodeId)) return [];
    visited.add(nodeId);

    const parents = this.parentMap.get(nodeId) || [];
    const result = [];

    for (const parentId of parents) {
      const parent = this.nodeMap.get(parentId);
      if (!parent) continue;

      result.push({
        id: parentId,
        functionName: parent.callFrame.functionName,
        url: parent.callFrame.url,
        lineNumber: parent.callFrame.lineNumber,
        hitCount: parent.hitCount,
        callers: this.getCallersChain(parentId, depth - 1, new Set(visited)),
      });
    }

    return result;
  }

  /**
   * Get callees chain (what this function calls)
   */
  getCalleesChain(nodeId, depth = 3, visited = new Set()) {
    if (depth === 0 || visited.has(nodeId)) return [];
    visited.add(nodeId);

    const node = this.nodeMap.get(nodeId);
    if (!node) return [];

    const children = node.children || [];
    const result = [];

    for (const childId of children) {
      const child = this.nodeMap.get(childId);
      if (!child) continue;

      result.push({
        id: childId,
        functionName: child.callFrame.functionName,
        url: child.callFrame.url,
        lineNumber: child.callFrame.lineNumber,
        hitCount: child.hitCount,
        callees: this.getCalleesChain(childId, depth - 1, new Set(visited)),
      });
    }

    // Sort by hitCount descending
    return result.sort((a, b) => (b.hitCount || 0) - (a.hitCount || 0));
  }

  /**
   * Generate Mermaid flowchart for a specific function
   */
  generateMermaidForFunction(functionName, options = {}) {
    const { callerDepth = 3, calleeDepth = 3, maxNodes = 15 } = options;
    const nodes = this.findAllNodesByName(functionName);
    if (nodes.length === 0) return null;

    const nodeIdSet = new Set();
    const edges = [];
    const nodeLabels = new Map();

    const sanitize = (name) => name.replace(/[<>{}|[\]\\/()]/g, '_').slice(0, 30);
    const getMermaidId = (id, name) => `N${id}`;

    // Use the node with highest hitCount
    const mainNode = nodes.reduce((a, b) => ((b.hitCount || 0) > (a.hitCount || 0) ? b : a), nodes[0]);

    const processNode = (node, isMain = false) => {
      const id = getMermaidId(node.id, node.functionName);
      if (!nodeIdSet.has(id)) {
        nodeIdSet.add(id);
        const label = sanitize(node.functionName || '(anonymous)');
        const style = isMain ? ':::main' : '';
        nodeLabels.set(id, { label, hitCount: node.hitCount, style });
      }
      return id;
    };

    // Process main node
    const mainId = processNode({ ...mainNode.callFrame, id: mainNode.id, hitCount: mainNode.hitCount }, true);

    // Process callers
    const processCallers = (nodeId, currentDepth) => {
      if (currentDepth === 0 || nodeIdSet.size >= maxNodes) return;
      const parents = this.parentMap.get(nodeId) || [];

      for (const parentId of parents.slice(0, 3)) {
        const parent = this.nodeMap.get(parentId);
        if (!parent || parent.callFrame.functionName === '(root)') continue;

        const parentMermaidId = processNode({ ...parent.callFrame, id: parentId, hitCount: parent.hitCount });
        const childMermaidId = getMermaidId(nodeId, '');
        edges.push({ from: parentMermaidId, to: childMermaidId });

        processCallers(parentId, currentDepth - 1);
      }
    };

    // Process callees
    const processCallees = (nodeId, currentDepth) => {
      if (currentDepth === 0 || nodeIdSet.size >= maxNodes) return;
      const node = this.nodeMap.get(nodeId);
      if (!node) return;

      const children = (node.children || [])
        .map((id) => this.nodeMap.get(id))
        .filter(Boolean)
        .sort((a, b) => (b.hitCount || 0) - (a.hitCount || 0))
        .slice(0, 3);

      for (const child of children) {
        if (child.callFrame.functionName === '(program)' || child.callFrame.functionName === '(idle)') continue;

        const childMermaidId = processNode({ ...child.callFrame, id: child.id, hitCount: child.hitCount });
        const parentMermaidId = getMermaidId(nodeId, '');
        edges.push({ from: parentMermaidId, to: childMermaidId });

        processCallees(child.id, currentDepth - 1);
      }
    };

    processCallers(mainNode.id, callerDepth);
    processCallees(mainNode.id, calleeDepth);

    // Generate Mermaid code
    const lines = ['graph TD'];

    // Add class definition for main node
    lines.push('    classDef main fill:#f96,stroke:#333,stroke-width:2px');

    // Add nodes with labels
    for (const [id, { label, hitCount, style }] of nodeLabels) {
      const hitLabel = hitCount ? ` (${hitCount})` : '';
      lines.push(`    ${id}["${label}${hitLabel}"]${style}`);
    }

    // Add edges
    const addedEdges = new Set();
    for (const { from, to } of edges) {
      const key = `${from}->${to}`;
      if (!addedEdges.has(key)) {
        lines.push(`    ${from} --> ${to}`);
        addedEdges.add(key);
      }
    }

    return lines.join('\n');
  }

  /**
   * Generate ASCII call tree
   */
  generateAsciiTree(functionName, depth = 4) {
    const nodes = this.findAllNodesByName(functionName);
    if (nodes.length === 0) return `Function "${functionName}" not found`;

    const mainNode = nodes.reduce((a, b) => ((b.hitCount || 0) > (a.hitCount || 0) ? b : a), nodes[0]);

    const lines = [];
    const shortUrl = (url) => {
      if (!url) return '';
      return url
        .replace(/.*\/application\//, '')
        .replace(/.*node_modules\//, '')
        .slice(0, 40);
    };

    // Show callers
    lines.push('=== Callers (who calls this function) ===');

    const printCallers = (nodeId, indent = '') => {
      const parents = this.parentMap.get(nodeId) || [];
      for (const parentId of parents.slice(0, 5)) {
        const parent = this.nodeMap.get(parentId);
        if (!parent || parent.callFrame.functionName === '(root)') continue;

        const cf = parent.callFrame;
        lines.push(`${indent}← ${cf.functionName} [${shortUrl(cf.url)}:${cf.lineNumber}]`);

        if (indent.length < depth * 2) {
          printCallers(parentId, indent + '  ');
        }
      }
    };

    printCallers(mainNode.id);

    // Show main function
    const mainCf = mainNode.callFrame;
    lines.push('');
    lines.push(
      `=== ${mainCf.functionName} [${shortUrl(mainCf.url)}:${mainCf.lineNumber}] (hitCount: ${mainNode.hitCount}) ===`,
    );
    lines.push('');

    // Show callees
    lines.push('=== Callees (what this function calls) ===');

    const printCallees = (nodeId, indent = '') => {
      const node = this.nodeMap.get(nodeId);
      if (!node) return;

      const children = (node.children || [])
        .map((id) => this.nodeMap.get(id))
        .filter(Boolean)
        .filter((n) => n.callFrame.functionName !== '(program)' && n.callFrame.functionName !== '(idle)')
        .sort((a, b) => (b.hitCount || 0) - (a.hitCount || 0))
        .slice(0, 5);

      for (const child of children) {
        const cf = child.callFrame;
        lines.push(`${indent}→ ${cf.functionName} [${shortUrl(cf.url)}:${cf.lineNumber}] (hits: ${child.hitCount})`);

        if (indent.length < depth * 2) {
          printCallees(child.id, indent + '  ');
        }
      }
    };

    printCallees(mainNode.id);

    return lines.join('\n');
  }
}

async function main() {
  console.log('Call Graph Generator for cnpmcore 4.18.0\n');

  const profileFiles = fs
    .readdirSync(PROFILE_DIR)
    .filter((f) => f.includes('cpuprofile'))
    .map((f) => path.join(PROFILE_DIR, f));

  if (profileFiles.length === 0) {
    console.error('No profile files found');
    process.exit(1);
  }

  // Use first profile for analysis
  const generator = new CallGraphGenerator(profileFiles[0]).load();

  // Key functions to analyze
  const keyFunctions = [
    'showPackageDownloads',
    'download',
    'plusPackageVersionCounter',
    'beforeCall',
    'Bone',
    'match',
    'injectProperty',
    'getOrCreateEggObject',
    'init',
  ];

  const diagrams = [];

  for (const funcName of keyFunctions) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Function: ${funcName}`);
    console.log('='.repeat(60));

    const asciiTree = generator.generateAsciiTree(funcName);
    console.log(asciiTree);

    const mermaid = generator.generateMermaidForFunction(funcName, {
      callerDepth: 2,
      calleeDepth: 2,
      maxNodes: 12,
    });

    if (mermaid) {
      diagrams.push({ funcName, mermaid, ascii: asciiTree });
    }
  }

  // Save diagrams to file
  const diagramsPath = path.join(OUTPUT_DIR, 'CALL_GRAPHS.md');
  const lines = ['# Call Relationship Diagrams', ''];

  for (const { funcName, mermaid, ascii } of diagrams) {
    lines.push(`## ${funcName}`);
    lines.push('');
    lines.push('### Call Tree');
    lines.push('```');
    lines.push(ascii);
    lines.push('```');
    lines.push('');
    lines.push('### Mermaid Diagram');
    lines.push('```mermaid');
    lines.push(mermaid);
    lines.push('```');
    lines.push('');
  }

  fs.writeFileSync(diagramsPath, lines.join('\n'));
  console.log(`\nDiagrams saved to: ${diagramsPath}`);
}

main().catch(console.error);
