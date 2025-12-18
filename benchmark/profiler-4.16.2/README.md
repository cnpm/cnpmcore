# CPU Profile Analysis - cnpmcore v4.16.2

This directory contains CPU profile analysis tools and reports for cnpmcore version 4.16.2.

## Profile Information

- **Source**: r.cnpmjs.org production instance
- **Date**: 2025-12-18
- **Duration**: 180 seconds
- **Profile File**: `~/Downloads/cnpmcore/4.16.2/r.cnpmjs.org-x-cpuprofile-325985-20251218-0`

## Key Findings

1. **CRC32 is the main hotspot** (53.94% of active CPU) - from `@cnpmjs/packument`
2. **Leoric Bone constructor** (6.83% of active CPU) - ORM overhead
3. **Application code is efficient** (1.65% of active CPU)

## Files

| File | Description |
|------|-------------|
| `REPORT.md` | Comprehensive analysis report |
| `CALL-DIAGRAM.md` | Call relationship diagrams with Mermaid flowcharts |
| `analysis-output.txt` | Raw output from analyze-profile.js |
| `hotspot-output.txt` | Raw output from hotspot-finder.js |

## Analysis Scripts

### 1. analyze-profile.js

Comprehensive CPU profile analyzer that shows:
- CPU time distribution (idle, active, GC)
- Top functions by self time
- Top files/modules by CPU time
- Category breakdown (Node.js core, NPM, Application)
- Application code hotspots
- NPM package hotspots

```bash
node analyze-profile.js <profile.cpuprofile>
```

### 2. hotspot-finder.js

Find specific hotspots with optional filtering:

```bash
# Show top 20 hotspots
node hotspot-finder.js <profile.cpuprofile> --top=20

# Filter by pattern
node hotspot-finder.js <profile.cpuprofile> --filter=crc32 --top=15
node hotspot-finder.js <profile.cpuprofile> --filter=leoric --top=15
node hotspot-finder.js <profile.cpuprofile> --filter=application --top=25
```

### 3. call-tree-analyzer.js

Analyze call relationships from application code to specific hotspots:

```bash
# Find how application calls crc32
node call-tree-analyzer.js <profile.cpuprofile> --target=crc32 --caller=application

# Find how application calls Bone constructor
node call-tree-analyzer.js <profile.cpuprofile> --target=Bone --caller=application
```

Outputs include Mermaid diagrams that can be rendered at https://mermaid.live

### 4. flamegraph-convert.js

Convert profile to folded stack format for flame graph generation:

```bash
node flamegraph-convert.js <profile.cpuprofile> > stacks.txt
# Then use FlameGraph tools: flamegraph.pl stacks.txt > flamegraph.svg
```

## Viewing Profiles

The `.cpuprofile` file can be viewed in:

1. **Chrome DevTools**: `chrome://inspect` -> Open dedicated DevTools -> Performance tab -> Load
2. **speedscope.app**: Upload directly at https://www.speedscope.app/
3. **VS Code**: Install "vscode-js-profile-flame" extension

## Recommendations

See `REPORT.md` for detailed recommendations. Summary:

### High Priority
1. Investigate CRC32 usage in `@cnpmjs/packument` (53.94% CPU)
2. Review package synchronization flow for optimization opportunities

### Medium Priority
3. Continue Leoric ORM optimizations
4. Monitor memory/GC patterns

### Low Priority
5. Application code is already well-optimized
