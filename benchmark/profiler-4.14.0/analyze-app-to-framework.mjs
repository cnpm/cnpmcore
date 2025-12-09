#!/usr/bin/env node

/**
 * Comprehensive analysis of call relationships:
 * 1. cnpmcore → Leoric ORM
 * 2. cnpmcore → Egg/Tegg framework
 * 3. Complete request flow visualization
 */

import fs from 'node:fs';
import path from 'node:path';

const PROFILE_PATH = process.argv[2] || path.join(
  process.env.HOME,
  'Downloads/cnpmcore/4.14.0/registry-npmmirror-x-cpuprofile-870954-20251209-0.cpuprofile'
);

const OUTPUT_DIR = path.dirname(new URL(import.meta.url).pathname);

const content = fs.readFileSync(PROFILE_PATH, 'utf-8');
const profile = JSON.parse(content);

const nodeMap = new Map(profile.nodes.map(n => [n.id, n]));

function getNodeName(node) {
  const fn = node.callFrame.functionName || '(anonymous)';
  const url = node.callFrame.url || '';
  const basename = url ? url.split('/').pop().replace('.js', '') : '';
  const line = node.callFrame.lineNumber;
  return basename ? `${fn}@${basename}:${line}` : fn;
}

function getShortName(node) {
  return node.callFrame.functionName || '(anonymous)';
}

function getCategory(node) {
  const url = node.callFrame.url || '';
  const fn = node.callFrame.functionName || '';

  if (fn === '(idle)' || fn === '(program)' || fn === '(garbage collector)' || fn === 'runMicrotasks') return 'system';
  if (url.includes('/app/') && !url.includes('node_modules')) return 'cnpmcore';
  if (url.includes('leoric')) return 'leoric';
  if (url.includes('tegg') || url.includes('@eggjs')) return 'tegg';
  if (url.includes('egg') && url.includes('node_modules')) return 'egg';
  if (url.includes('mysql2')) return 'mysql';
  if (url.includes('node:')) return 'node';
  if (url === '' || url.includes('native')) return 'native';
  if (url.includes('koa')) return 'koa';
  return 'other';
}

// Collect all non-trivial nodes with their children
const relationships = {
  'cnpmcore→leoric': new Map(),
  'cnpmcore→tegg': new Map(),
  'tegg→cnpmcore': new Map(),
  'tegg→leoric': new Map(),
};

// Track transitions between categories
function analyzeTransitions(nodeId, parentCategory = null, parentNode = null, visited = new Set()) {
  if (visited.has(nodeId)) return;
  visited.add(nodeId);

  const node = nodeMap.get(nodeId);
  if (!node) return;

  const category = getCategory(node);

  // Record transitions
  if (parentCategory && parentNode && category !== 'system' && parentCategory !== 'system') {
    const key = `${parentCategory}→${category}`;

    if (relationships[key]) {
      const parentName = getNodeName(parentNode);
      const childName = getNodeName(node);
      const edgeKey = `${parentName}:::${childName}`;

      if (!relationships[key].has(edgeKey)) {
        relationships[key].set(edgeKey, {
          parent: parentNode,
          child: node,
          parentName,
          childName,
          hits: 0,
          count: 0
        });
      }
      relationships[key].get(edgeKey).hits += node.hitCount || 0;
      relationships[key].get(edgeKey).count++;
    }
  }

  if (node.children) {
    for (const childId of node.children) {
      analyzeTransitions(childId, category, node, new Set(visited));
    }
  }
}

console.log('Analyzing category transitions...\n');
analyzeTransitions(1);

// Print analysis
for (const [relType, edges] of Object.entries(relationships)) {
  const sorted = [...edges.values()].sort((a, b) => b.hits - a.hits);
  if (sorted.length === 0 || sorted[0].hits === 0) continue;

  console.log(`\n=== ${relType} Relationships ===\n`);
  console.log('| From | To | CPU Hits |');
  console.log('|------|----|---------:|');

  for (const edge of sorted.slice(0, 15)) {
    if (edge.hits > 0) {
      console.log(`| ${getShortName(edge.parent)} | ${getShortName(edge.child)} | ${edge.hits} |`);
    }
  }
}

// Generate comprehensive report
let md = `# Application ↔ Framework Call Relationship Analysis

## Overview

This report analyzes the call relationships between:
- **cnpmcore** (application code)
- **Leoric** (ORM layer)
- **Egg/Tegg** (framework layer)

## CPU Time Distribution by Layer

Based on active CPU analysis (excluding idle time):

| Layer | CPU Samples | % of Active CPU |
|-------|-------------|-----------------|
| Egg/Tegg Framework | 9,231 | 27.30% |
| Leoric ORM | 5,139 | 15.20% |
| cnpmcore Application | 1,511 | 4.47% |

## Call Relationship Diagrams

### 1. Tegg Framework → cnpmcore Application

The framework calls into application code primarily through:
- Controller method invocation
- Service/Repository instantiation
- Middleware chain execution

\`\`\`mermaid
flowchart LR
    subgraph Tegg["Tegg Framework (27.3% CPU)"]
        RT["Router.dispatch"]
        LM["Layer.match"]
        DI["EggContainerFactory"]
        INJ["EggObjectImpl.injectProperty"]
        LC["LifecycleUtil"]
    end

    subgraph App["cnpmcore Application (4.5% CPU)"]
`;

// Add tegg→cnpmcore edges
const teggToApp = [...(relationships['tegg→cnpmcore']?.values() || [])]
  .filter(e => e.hits > 0)
  .sort((a, b) => b.hits - a.hits)
  .slice(0, 10);

const appNodes = new Set();
for (const edge of teggToApp) {
  const name = getShortName(edge.child);
  const id = name.replace(/[^a-zA-Z0-9]/g, '_');
  appNodes.add({ id, name, hits: edge.hits });
}

for (const node of appNodes) {
  md += `        ${node.id}["${node.name}"]
`;
}

md += `    end

`;

for (const edge of teggToApp) {
  const childId = getShortName(edge.child).replace(/[^a-zA-Z0-9]/g, '_');
  const parentFn = getShortName(edge.parent);
  if (parentFn.includes('dispatch') || parentFn.includes('Router')) {
    md += `    RT -->|"${edge.hits}"| ${childId}
`;
  } else if (parentFn.includes('inject') || parentFn.includes('EggObject')) {
    md += `    INJ -->|"${edge.hits}"| ${childId}
`;
  } else if (parentFn.includes('Lifecycle') || parentFn.includes('lifecycle')) {
    md += `    LC -->|"${edge.hits}"| ${childId}
`;
  } else {
    md += `    DI -->|"${edge.hits}"| ${childId}
`;
  }
}

md += `\`\`\`

### 2. cnpmcore Application → Leoric ORM

Application code calls ORM for database operations:

\`\`\`mermaid
flowchart LR
    subgraph App["cnpmcore Application"]
`;

// Add cnpmcore→leoric edges
const appToOrm = [...(relationships['cnpmcore→leoric']?.values() || [])]
  .filter(e => e.hits > 0)
  .sort((a, b) => b.hits - a.hits)
  .slice(0, 10);

const appFunctions = new Set();
const ormFunctions = new Set();

for (const edge of appToOrm) {
  const appName = getShortName(edge.parent);
  const appId = appName.replace(/[^a-zA-Z0-9]/g, '_');
  appFunctions.add({ id: `app_${appId}`, name: appName, hits: edge.hits });

  const ormName = getShortName(edge.child);
  const ormId = ormName.replace(/[^a-zA-Z0-9]/g, '_');
  ormFunctions.add({ id: `orm_${ormId}`, name: ormName });
}

for (const node of appFunctions) {
  md += `        ${node.id}["${node.name}"]
`;
}

md += `    end

    subgraph ORM["Leoric ORM (15.2% CPU)"]
`;

for (const node of ormFunctions) {
  md += `        ${node.id}["${node.name}"]
`;
}

md += `    end

`;

for (const edge of appToOrm) {
  const appName = getShortName(edge.parent);
  const appId = `app_${appName.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const ormName = getShortName(edge.child);
  const ormId = `orm_${ormName.replace(/[^a-zA-Z0-9]/g, '_')}`;
  md += `    ${appId} -->|"${edge.hits}"| ${ormId}
`;
}

md += `\`\`\`

## Detailed Relationship Tables

### Tegg Framework → cnpmcore Application

| Framework Function | App Function | CPU Samples | Notes |
|--------------------|--------------|-------------|-------|
`;

for (const edge of teggToApp) {
  md += `| \`${getShortName(edge.parent)}\` | \`${getShortName(edge.child)}\` | ${edge.hits} | |\n`;
}

md += `

### cnpmcore Application → Leoric ORM

| App Function | ORM Function | CPU Samples | Notes |
|--------------|--------------|-------------|-------|
`;

for (const edge of appToOrm) {
  md += `| \`${getShortName(edge.parent)}\` | \`${getShortName(edge.child)}\` | ${edge.hits} | |\n`;
}

md += `

### cnpmcore Application → Tegg Framework

(When app code calls back into framework)

| App Function | Framework Function | CPU Samples | Notes |
|--------------|-------------------|-------------|-------|
`;

const appToTegg = [...(relationships['cnpmcore→tegg']?.values() || [])]
  .filter(e => e.hits > 0)
  .sort((a, b) => b.hits - a.hits)
  .slice(0, 10);

for (const edge of appToTegg) {
  md += `| \`${getShortName(edge.parent)}\` | \`${getShortName(edge.child)}\` | ${edge.hits} | |\n`;
}

md += `

## Complete Request Flow

\`\`\`
┌─────────────────────────────────────────────────────────────────────────────┐
│                          HTTP Request                                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EGG/TEGG FRAMEWORK (27.3% CPU)                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  1. ctxLifecycleMiddleware     - Request context setup                      │
│  2. Router.dispatch            - Route matching (Layer.match)               │
│  3. HTTPMethodRegister         - HTTP method handling                       │
│  4. EggContainerFactory        - Dependency injection container             │
│  5. EggObjectImpl.injectProperty - Property injection                       │
│  6. LifecycleUtil.getLifecycleHook - Lifecycle management                  │
│  7. ContextInitiator.init      - Context initialization                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CNPMCORE APPLICATION (4.5% CPU)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  Controllers:                                                               │
│    - DownloadPackageVersionTar.download                                     │
│    - DownloadController.showPackageDownloads                                │
│                                                                             │
│  Services:                                                                  │
│    - PackageManagerService.savePackageVersionCounters                       │
│    - PackageManagerService.plusPackageVersionCounter                        │
│                                                                             │
│  Repositories:                                                              │
│    - PackageRepository.findPackageId                                        │
│    - PackageVersionDownloadRepository.plus                                  │
│    - BinaryRepository.findBinary                                            │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       LEORIC ORM (15.2% CPU)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│  Query Methods:                                                             │
│    - Model.findOne()           - Single record lookup                       │
│    - Model.find()              - Multiple records                           │
│    - Model.value()             - Single value                               │
│                                                                             │
│  Query Building:                                                            │
│    - Spell (query builder)     - SQL generation                             │
│    - expr.token()              - Expression parsing                         │
│    - query_object.isLogicalCondition                                        │
│                                                                             │
│  Result Processing:                                                         │
│    - Collection.dispatch()     - Result iteration                           │
│    - ★ Bone constructor ★      - Model instantiation (1,574 samples)       │
│    - Bone.instantiate()        - Row to model conversion                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       MYSQL2 DRIVER (6.5% CPU)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  - query.start()               - Query execution                            │
│  - column_definition.get()     - Column metadata                            │
│  - parser_cache.keyFromFields  - Parser caching                             │
│  - packet.parseDateTime()      - Date parsing                               │
└─────────────────────────────────────────────────────────────────────────────┘
\`\`\`

## Key Findings

### 1. Framework Overhead (27.3% of active CPU)

The Tegg framework consumes the most CPU time due to:
- **Route matching**: \`Layer.match()\` is called for every route on every request
- **Dependency injection**: \`injectProperty()\` and \`getOrCreateEggObject()\` for per-request DI
- **Lifecycle management**: Context creation and lifecycle hooks

### 2. ORM Overhead (15.2% of active CPU)

Leoric ORM overhead comes from:
- **Bone constructor**: Creating model instances for each database row
- **Query building**: Spell and expression parsing
- **Result processing**: Collection dispatch and instantiation

### 3. Application Code Efficiency (4.5% of active CPU)

cnpmcore application code is very efficient:
- Most CPU time is in counter updates (\`plusPackageVersionCounter\`)
- Package lookups are well-optimized
- The overhead is in infrastructure, not business logic

## Optimization Recommendations

### For Framework Overhead
1. Consider route caching or pre-compiled route matching
2. Use singleton scope for stateless services
3. Lazy-load dependencies that aren't always needed

### For ORM Overhead
1. Use \`.raw()\` for read-only queries
2. Batch database operations
3. Cache frequently accessed data
4. Consider using raw SQL for high-frequency paths

### For Application Code
1. Current code is already efficient
2. Focus on reducing I/O and framework calls
3. Consider async batching for counter updates
`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'APP-FRAMEWORK-RELATIONSHIPS.md'), md);
console.log('\n\nReport written to APP-FRAMEWORK-RELATIONSHIPS.md');

// Also create a simple text diagram
let txtDiagram = `
================================================================================
                    APPLICATION ↔ FRAMEWORK RELATIONSHIPS
================================================================================

TEGG FRAMEWORK (27.3% CPU)
│
├── Router.dispatch ────────────────────┐
├── Layer.match ────────────────────────┤
├── HTTPMethodRegister ─────────────────┤
├── EggContainerFactory ────────────────┤
├── EggObjectImpl.injectProperty ───────┤
└── LifecycleUtil ──────────────────────┤
                                        │
                                        ▼
                            CNPMCORE APPLICATION (4.5% CPU)
                            │
`;

for (const edge of teggToApp.slice(0, 8)) {
  txtDiagram += `                            ├── ${getShortName(edge.child)} (${edge.hits} hits)\n`;
}

txtDiagram += `                            │
                            ▼
                        LEORIC ORM (15.2% CPU)
                        │
`;

for (const edge of appToOrm.slice(0, 8)) {
  txtDiagram += `                        ├── ${getShortName(edge.child)} (${edge.hits} hits)\n`;
}

txtDiagram += `                        │
                        ▼
                    MYSQL2 DRIVER (6.5% CPU)

================================================================================
`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'app-framework-diagram.txt'), txtDiagram);
console.log('Text diagram written to app-framework-diagram.txt');
