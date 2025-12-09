#!/usr/bin/env node

/**
 * Analyze call relationships between cnpmcore and Request Routing hotspots
 *
 * Request routing hotspots include:
 * - Layer.match (695 samples, 2.06%)
 * - Router.dispatch (483 samples)
 * - HTTPMethodRegister
 * - koa-compose dispatch
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

function isRouting(node) {
  const url = node.callFrame.url || '';
  const fn = node.callFrame.functionName || '';

  return url.includes('router') || url.includes('Router') ||
         url.includes('Layer') || url.includes('layer') ||
         url.includes('koa-compose') ||
         url.includes('HTTPMethodRegister') ||
         fn === 'match' || fn === 'dispatch' ||
         (url.includes('middleware') && fn.includes('dispatch'));
}

function isCnpmcore(node) {
  const url = node.callFrame.url || '';
  return url.includes('/app/') && !url.includes('node_modules');
}

function isTegg(node) {
  const url = node.callFrame.url || '';
  return url.includes('tegg') || url.includes('@eggjs');
}

// Find all routing-related nodes
const routingNodes = profile.nodes.filter(n => isRouting(n) && n.hitCount > 0);

console.log('=== Request Routing Hotspots ===\n');
console.log('| Function | Location | CPU Samples |');
console.log('|----------|----------|-------------|');

const sortedRouting = routingNodes.sort((a, b) => (b.hitCount || 0) - (a.hitCount || 0));
for (const node of sortedRouting.slice(0, 20)) {
  const name = getNodeName(node);
  const url = node.callFrame.url || '';
  const basename = url ? url.split('/').pop() : '(native)';
  console.log(`| ${getShortName(node)} | ${basename} | ${node.hitCount} |`);
}

const totalRoutingSamples = routingNodes.reduce((sum, n) => sum + (n.hitCount || 0), 0);
console.log(`\nTotal routing samples: ${totalRoutingSamples}`);

// Build parent map
const parentMap = new Map();
for (const node of profile.nodes) {
  if (node.children) {
    for (const childId of node.children) {
      if (!parentMap.has(childId)) {
        parentMap.set(childId, []);
      }
      parentMap.get(childId).push(node.id);
    }
  }
}

// Find what cnpmcore code is called AFTER routing
console.log('\n\n=== Routing → cnpmcore Application ===\n');
console.log('These are the application entry points that routing dispatches to:\n');

const routingToApp = new Map();

function findAppAfterRouting(nodeId, routingAncestor = null, visited = new Set()) {
  if (visited.has(nodeId)) return;
  visited.add(nodeId);

  const node = nodeMap.get(nodeId);
  if (!node) return;

  // If this is a routing node, remember it
  if (isRouting(node)) {
    routingAncestor = node;
  }

  // If we found cnpmcore code and we came from routing
  if (isCnpmcore(node) && routingAncestor) {
    const routingName = getNodeName(routingAncestor);
    const appName = getNodeName(node);
    const key = `${routingName}:::${appName}`;

    if (!routingToApp.has(key)) {
      routingToApp.set(key, {
        routing: routingAncestor,
        app: node,
        hits: 0,
        count: 0
      });
    }
    routingToApp.get(key).hits += node.hitCount || 0;
    routingToApp.get(key).count++;

    // Don't continue searching - we found the app entry point
    return;
  }

  if (node.children) {
    for (const childId of node.children) {
      findAppAfterRouting(childId, routingAncestor, new Set(visited));
    }
  }
}

findAppAfterRouting(1);

const sortedRoutingToApp = [...routingToApp.values()]
  .sort((a, b) => b.hits - a.hits);

console.log('| Routing Function | App Function | CPU Samples |');
console.log('|------------------|--------------|-------------|');

for (const edge of sortedRoutingToApp.slice(0, 20)) {
  console.log(`| ${getShortName(edge.routing)} | ${getShortName(edge.app)} | ${edge.hits} |`);
}

// Find the complete routing chain for each app entry point
console.log('\n\n=== Complete Routing Chains ===\n');

// Group by app function
const appEntryPoints = new Map();
for (const edge of sortedRoutingToApp) {
  const appName = getNodeName(edge.app);
  if (!appEntryPoints.has(appName)) {
    appEntryPoints.set(appName, {
      app: edge.app,
      totalHits: 0,
      routingSources: []
    });
  }
  appEntryPoints.get(appName).totalHits += edge.hits;
  appEntryPoints.get(appName).routingSources.push(edge);
}

const sortedAppEntries = [...appEntryPoints.entries()]
  .sort((a, b) => b[1].totalHits - a[1].totalHits);

for (const [appName, data] of sortedAppEntries.slice(0, 10)) {
  if (data.totalHits === 0) continue;

  console.log(`### ${getShortName(data.app)} (${data.totalHits} samples)`);
  console.log(`Location: ${appName}\n`);
  console.log('Routing chain:');
  console.log('```');

  // Trace back the routing chain
  const appNode = data.app;
  const parents = parentMap.get(appNode.id) || [];

  // Build the chain going backwards
  const chain = [appNode];
  let current = parents[0];
  while (current) {
    const node = nodeMap.get(current);
    if (!node) break;
    chain.unshift(node);
    const nextParents = parentMap.get(current) || [];
    current = nextParents[0];

    // Stop at root or after going too deep
    if (chain.length > 15) break;
  }

  // Print the chain, focusing on routing-related nodes
  for (const node of chain) {
    const name = getNodeName(node);
    if (isRouting(node)) {
      console.log(`[ROUTING] ${name}`);
    } else if (isCnpmcore(node)) {
      console.log(`[APP]     ${name}`);
    } else if (isTegg(node)) {
      console.log(`[TEGG]    ${getShortName(node)}`);
    }
  }
  console.log('```\n');
}

// Analyze which routes are most expensive
console.log('\n=== Route Handler Analysis ===\n');

// Find controller methods and their routing cost
const controllerMethods = new Map();

for (const edge of sortedRoutingToApp) {
  const appUrl = edge.app.callFrame.url || '';
  if (appUrl.includes('controller') || appUrl.includes('Controller')) {
    const name = getNodeName(edge.app);
    if (!controllerMethods.has(name)) {
      controllerMethods.set(name, { node: edge.app, routingCost: 0, count: 0 });
    }
    controllerMethods.get(name).routingCost += edge.hits;
    controllerMethods.get(name).count++;
  }
}

const sortedControllers = [...controllerMethods.entries()]
  .sort((a, b) => b[1].routingCost - a[1].routingCost);

console.log('| Controller Method | Routing CPU | Call Count |');
console.log('|-------------------|-------------|------------|');

for (const [name, data] of sortedControllers.slice(0, 15)) {
  const fn = getShortName(data.node);
  console.log(`| ${fn} | ${data.routingCost} | ${data.count} |`);
}

// Generate Mermaid diagram
let mermaid = `flowchart TB
    subgraph Request["HTTP Request"]
        REQ[Incoming Request]
    end

    subgraph Routing["Request Routing (10.1% CPU)"]
`;

// Add routing nodes
const routingFunctions = new Map();
for (const node of sortedRouting.slice(0, 8)) {
  const name = getShortName(node);
  const id = name.replace(/[^a-zA-Z0-9]/g, '_');
  if (!routingFunctions.has(id)) {
    routingFunctions.set(id, { name, hits: node.hitCount });
    mermaid += `        ${id}["${name}<br/>(${node.hitCount} samples)"]\n`;
  }
}

mermaid += `    end

    subgraph App["cnpmcore Controllers"]
`;

// Add app nodes
const appFunctions = new Map();
for (const [name, data] of sortedControllers.slice(0, 8)) {
  const fn = getShortName(data.node);
  const id = `app_${fn.replace(/[^a-zA-Z0-9]/g, '_')}`;
  if (!appFunctions.has(id)) {
    appFunctions.set(id, { name: fn, hits: data.routingCost });
    mermaid += `        ${id}["${fn}"]\n`;
  }
}

mermaid += `    end

    REQ --> Routing
`;

// Add edges from routing to app
for (const edge of sortedRoutingToApp.slice(0, 15)) {
  if (edge.hits === 0) continue;

  const routingName = getShortName(edge.routing);
  const routingId = routingName.replace(/[^a-zA-Z0-9]/g, '_');

  const appName = getShortName(edge.app);
  const appId = `app_${appName.replace(/[^a-zA-Z0-9]/g, '_')}`;

  if (routingFunctions.has(routingId) && appFunctions.has(appId)) {
    mermaid += `    ${routingId} -->|"${edge.hits}"| ${appId}\n`;
  }
}

// Generate markdown report
let md = `# Request Routing → Application Call Relationship

## Overview

This report analyzes the call relationships between the request routing layer and cnpmcore application code.

**Request routing consumes 10.1% of active CPU time** (3,431 samples), making it the third largest CPU consumer after framework DI and ORM.

## Routing Hotspots

| Function | Location | CPU Samples | % of Active |
|----------|----------|-------------|-------------|
`;

for (const node of sortedRouting.slice(0, 15)) {
  const name = getShortName(node);
  const url = node.callFrame.url || '';
  const basename = url ? url.split('/').pop() : '(native)';
  const pct = ((node.hitCount / 33819) * 100).toFixed(2);
  md += `| \`${name}\` | ${basename} | ${node.hitCount} | ${pct}% |\n`;
}

md += `

**Total routing samples: ${totalRoutingSamples}**

## How Routing Works

\`\`\`
HTTP Request
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    KOA-COMPOSE                                  │
│  dispatch() - Middleware chain execution (333 samples)         │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    @EGGJS/ROUTER                                │
│  Router.dispatch() - Route dispatching (513 samples)           │
│  Router.match() - Find matching route                          │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LAYER MATCHING                               │
│  Layer.match() - Pattern matching (695 samples)                │
│  - Regex matching for each registered route                    │
│  - Path parameter extraction                                   │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    HTTP METHOD REGISTER                         │
│  HTTPMethodRegister - Method-specific handlers (645 samples)   │
│  - GET, POST, PUT, DELETE routing                              │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CNPMCORE CONTROLLERS                         │
│  Application route handlers                                    │
└─────────────────────────────────────────────────────────────────┘
\`\`\`

## Routing → Application Entry Points

| Routing Function | Application Function | CPU Samples |
|------------------|---------------------|-------------|
`;

for (const edge of sortedRoutingToApp.slice(0, 20)) {
  if (edge.hits > 0) {
    md += `| \`${getShortName(edge.routing)}\` | \`${getShortName(edge.app)}\` | ${edge.hits} |\n`;
  }
}

md += `

## Controller Methods by Routing Cost

These controllers are reached through routing and their associated routing overhead:

| Controller Method | Routing CPU | Notes |
|-------------------|-------------|-------|
`;

for (const [name, data] of sortedControllers.slice(0, 12)) {
  const fn = getShortName(data.node);
  md += `| \`${fn}\` | ${data.routingCost} | |\n`;
}

md += `

## Call Flow Diagram

\`\`\`mermaid
${mermaid}
\`\`\`

## Detailed Routing Chains

`;

for (const [appName, data] of sortedAppEntries.slice(0, 8)) {
  if (data.totalHits === 0) continue;

  md += `### ${getShortName(data.app)} (${data.totalHits} samples)

\`\`\`
`;

  const appNode = data.app;
  const parents = parentMap.get(appNode.id) || [];

  const chain = [appNode];
  let current = parents[0];
  while (current) {
    const node = nodeMap.get(current);
    if (!node) break;
    chain.unshift(node);
    const nextParents = parentMap.get(current) || [];
    current = nextParents[0];
    if (chain.length > 12) break;
  }

  for (const node of chain) {
    const name = getNodeName(node);
    if (isRouting(node)) {
      md += `[ROUTING] ${getShortName(node)}\n`;
    } else if (isCnpmcore(node)) {
      md += `[APP]     ${getShortName(node)}\n`;
    } else if (isTegg(node)) {
      md += `[TEGG]    ${getShortName(node)}\n`;
    }
  }
  md += `\`\`\`

`;
}

md += `## Optimization Recommendations

### 1. Route Matching Optimization

\`Layer.match()\` consumes 695 samples (2.06% of active CPU). Consider:
- **Route ordering**: Place most frequently accessed routes first
- **Route prefixes**: Group routes by prefix to reduce matching iterations
- **Static route caching**: Cache static route matches

### 2. Reduce Middleware Chain

\`koa-compose dispatch()\` adds overhead for each middleware:
- Review middleware chain length
- Remove unused middlewares
- Consider combining related middlewares

### 3. Route Registration

With many routes registered, each request must iterate through:
- The current profile shows significant \`HTTPMethodRegister\` overhead
- Consider route grouping by path prefix
- Use more specific route patterns to match earlier

### 4. Controller Design

For high-traffic endpoints like \`download\`:
- Consider dedicated fast-path routing
- Minimize middleware for hot paths
- Use route-specific optimization

## Summary

The routing overhead is distributed across:

| Component | CPU Samples | % of Routing |
|-----------|-------------|--------------|
| Layer.match | 695 | 20.3% |
| HTTPMethodRegister | 645+ | 18.8% |
| Router.dispatch | 513 | 15.0% |
| koa-compose dispatch | 333 | 9.7% |
| Other routing | ~1245 | 36.2% |
| **Total** | **3,431** | **100%** |

The main application entry points reached through routing are:
1. \`download\` - Package tarball downloads
2. \`show\` - Package metadata
3. \`beforeCall\` / \`afterFinally\` - AOP timing hooks
`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'ROUTING-RELATIONSHIPS.md'), md);
console.log('\n\nReport written to ROUTING-RELATIONSHIPS.md');

// Write mermaid diagram
fs.writeFileSync(path.join(OUTPUT_DIR, 'routing-diagram.mmd'), mermaid);
console.log('Mermaid diagram written to routing-diagram.mmd');

// Create text diagram
let txtDiagram = `
================================================================================
                    REQUEST ROUTING → APPLICATION
================================================================================

HTTP Request
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ROUTING LAYER (10.1% CPU)                           │
├─────────────────────────────────────────────────────────────────────────────┤
`;

for (const node of sortedRouting.slice(0, 6)) {
  const name = getShortName(node);
  const samples = String(node.hitCount).padStart(4);
  txtDiagram += `│  ${samples} samples - ${name.padEnd(55)} │\n`;
}

txtDiagram += `└─────────────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CNPMCORE CONTROLLERS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
`;

for (const [name, data] of sortedControllers.slice(0, 6)) {
  const fn = getShortName(data.node);
  const samples = String(data.routingCost).padStart(4);
  txtDiagram += `│  ${samples} samples - ${fn.padEnd(55)} │\n`;
}

txtDiagram += `└─────────────────────────────────────────────────────────────────────────────┘

================================================================================
                         ROUTING CHAIN EXAMPLES
================================================================================
`;

for (const edge of sortedRoutingToApp.slice(0, 10)) {
  if (edge.hits > 0) {
    txtDiagram += `
${getShortName(edge.routing).padEnd(30)} ──→ ${getShortName(edge.app)} (${edge.hits} samples)`;
  }
}

txtDiagram += `

================================================================================
`;

fs.writeFileSync(path.join(OUTPUT_DIR, 'routing-diagram.txt'), txtDiagram);
console.log('Text diagram written to routing-diagram.txt');
