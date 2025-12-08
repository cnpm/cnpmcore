# CPU Profile Analysis Report - cnpmcore v4.12.0

**Date:** 2025-12-08
**Profile:** registry-npmmirror-x-cpuprofile-1546418-20251208-0.cpuprofile
**Duration:** 180.02 seconds (3 minutes)
**Total Samples:** 163,745

---

## Executive Summary

This CPU profile was captured from a production cnpmcore v4.12.0 instance. The analysis reveals several key performance characteristics and optimization opportunities.

### Key Findings

1. **CPU Utilization**: 25.80% active CPU time (71.20% idle)
2. **Top Bottleneck**: Leoric ORM `Bone` constructor consumes 7.11% of active CPU time
3. **GC Overhead**: 1.60% of total time spent in garbage collection
4. **NPM Package Overhead**: 54.68% of active time spent in NPM dependencies

---

## CPU Time Distribution

| Category | Samples | % of Total | % of Active |
|----------|---------|------------|-------------|
| Idle Time | 117,123 | 71.20% | - |
| Active/User Time | 42,437 | 25.80% | 100% |
| Program Time | 2,289 | 1.39% | - |
| GC Time | 2,639 | 1.60% | - |

### Active Time Breakdown by Source

| Category | Hits | % of Active |
|----------|------|-------------|
| NPM Packages | 23,206 | 54.68% |
| Node.js Core | 10,877 | 25.63% |
| Native/V8 | 6,409 | 15.10% |
| Application Code | 1,945 | 4.58% |

---

## Top Performance Hotspots

### #1 - Leoric `Bone` Constructor (7.11%)

**Location:** `leoric@2.13.9/lib/bone.js:150`
**Self Time:** 3,017 samples (7.11% of active)

The Bone constructor is the single largest CPU consumer. This is called for every database row instantiation.

**Call Path:**
```
ignite() → init() → dispatch() → instantiate() → ContextModelClass → Bone
```

**Impact:** High - affects all database queries

### #2 - `structuredClone` (4.00% combined)

**Location:** Native + `node:internal/worker/js_transferable:112`
**Self Time:** 1,698 samples (1,081 + 617)

Used by Leoric's `cloneValue` function for deep cloning database row values.

**Call Path:**
```
instantiate() → cloneValue() → structuredClone
```

**Impact:** Medium-High - called for each row instantiation

### #3 - Router `match` Function (1.40%)

**Location:** `@eggjs/router/dist/Layer.js:72`
**Self Time:** 595 samples

Route matching for each HTTP request.

### #4 - Leoric `dispatch` (1.33%)

**Location:** `leoric@2.13.9/lib/collection.js:81`
**Self Time:** 564 samples

Collection iteration and dispatch for query results.

### #5 - HTTP Header Parsing (1.31%)

**Location:** `node:_http_incoming:382`
**Self Time:** 556 samples

Node.js HTTP header parsing - expected overhead for HTTP server.

---

## Leoric ORM Analysis

Leoric ORM consumes **16.48%** of active CPU time, making it the largest single dependency.

### Leoric Function Breakdown

| Function | Hits | % | File |
|----------|------|---|------|
| Bone (constructor) | 3,017 | 7.11% | bone.js:150 |
| dispatch | 564 | 1.33% | collection.js:81 |
| instantiate | 381 | 0.90% | bone.js:1282 |
| _setRaw | 215 | 0.51% | bone.js:300 |
| _setRawSaved | 173 | 0.41% | bone.js:314 |
| query | 138 | 0.33% | mysql/index.js:70 |
| cloneValue | 79 | 0.19% | bone.js:112 |
| ignite | 114 | 0.27% | spell.js:441 |
| isLogicalCondition | 172 | 0.40% | query_object.js:102 |
| attribute | 101 | 0.24% | bone.js:198 |

**Total Leoric:** ~6,993 samples (16.48%)

### Recommendations for Leoric Optimization

1. **Bone Constructor Overhead**: Consider upgrading Leoric if newer versions optimize the constructor
2. **structuredClone Usage**: The cloneValue function uses structuredClone which is expensive; consider if deep cloning is always necessary
3. **Batch Processing**: Where possible, batch database operations to reduce per-row overhead

---

## Application Code Hotspots

| Rank | Function | Hits | % | Location |
|------|----------|------|---|----------|
| 1 | readDistBytesToJSON | 346 | 0.82% | DistRepository.js:31 |
| 2 | convertModelToEntity | 195 | 0.46% | ModelConvertor.js:74 |
| 3 | show | 191 | 0.45% | ShowPackageController.js:20 |
| 4 | _listPackageFullOrAbbreviatedManifests | 129 | 0.30% | PackageManagerService.js:806 |
| 5 | plusPackageVersionCounter | 116 | 0.27% | PackageManagerService.js:407 |
| 6 | syncPackage | 90 | 0.21% | PackageSearchService.js:16 |
| 7 | listBinaries | 43 | 0.10% | BinaryRepository.js:33 |
| 8 | beforeCall (AsyncTimer) | 69 | 0.16% | AsyncTimer.js:17 |
| 9 | afterFinally (AsyncTimer) | 61 | 0.14% | AsyncTimer.js:24 |
| 10 | download | 48 | 0.11% | DownloadPackageVersionTar.js:26 |

### Key Observations

1. **readDistBytesToJSON (0.82%)**: JSON parsing from NFS storage is a notable hotspot
2. **convertModelToEntity (0.46%)**: Model-to-entity conversion uses Leoric's property accessors
3. **ShowPackageController.show (0.45%)**: Main package info endpoint - expected to be hot
4. **AsyncTimer AOP overhead (0.30%)**: Timing instrumentation has measurable overhead

---

## Tegg Framework Overhead

| Function | Hits | % | Location |
|----------|------|---|----------|
| injectProperty | 368 | 0.87% | EggObjectImpl.js:165 |
| initWithInjectProperty | 300 | 0.71% | EggObjectImpl.js:20 |
| init (ContextInitiator) | 274 | 0.65% | ContextInitiator.js:13 |
| createCallContext | 202 | 0.48% | AspectExecutor.js:20 |
| getOrCreateEggObject | 188 | 0.44% | EggContainerFactory.js:28 |
| HTTPMethodRegister (anon) | 519 | 1.23% | HTTPMethodRegister.js |

**Total Tegg Runtime:** ~2,753 samples (6.49%)

The dependency injection and AOP runtime have measurable but expected overhead for a DI framework.

---

## mysql2 Driver Analysis

| Function | Hits | % | Location |
|----------|------|---|----------|
| get (column_definition) | 481 | 1.13% | column_definition.js:263 |
| start (query) | 334 | 0.79% | query.js:48 |
| keyFromFields | 167 | 0.39% | parser_cache.js:9 |
| parseDateTime | 114 | 0.27% | packet.js:649 |

**Total mysql2:** ~2,175 samples (5.13%)

MySQL driver overhead is reasonable for the query volume.

---

## Optimization Recommendations

### High Priority

1. **Leoric Bone Constructor Optimization**
   - This is the #1 hotspot at 7.11%
   - Consider upgrading Leoric to a version that optimizes constructor overhead
   - Recent Leoric versions (2.14+) may have addressed this with `avoids Bone constructor overhead for each row` optimization

2. **structuredClone Reduction**
   - 4% of CPU time spent on deep cloning
   - Evaluate if cloning is necessary for all query results
   - Consider using raw query results where full ORM features aren't needed

### Medium Priority

3. **convertModelToEntity Optimization**
   - Uses Leoric property accessors which trigger bone.js:198 (attribute)
   - Consider caching entity conversion for frequently accessed models
   - Evaluate using raw objects instead of ORM models for read-only operations

4. **Router Matching Overhead**
   - 2.52% combined for router match/dispatch
   - Consider caching route matches or optimizing route patterns

### Low Priority

5. **AsyncTimer AOP Overhead**
   - 0.30% for timing instrumentation
   - Consider making it configurable for production

6. **JSON Parsing (readDistBytesToJSON)**
   - 0.82% for JSON parsing from NFS
   - Consider using streaming JSON parser for large manifests

---

## Files in This Directory

- `analyze-profile.js` - Basic CPU profile analyzer
- `hotspot-finder.js` - Find hotspots with call stacks
- `call-tree-analyzer.js` - Analyze call relationships
- `flamegraph-convert.js` - Convert to flamegraph format
- `basic-analysis.md` - Full analysis output
- `hotspots.md` - Top 30 hotspots with call stacks
- `app-hotspots.md` - Application code hotspots
- `leoric-hotspots.md` - Leoric ORM hotspots
- `bone-callers.md` - Bone constructor call tree analysis
- `REPORT.md` - This summary report

## Usage

```bash
# Basic analysis
node analyze-profile.js ~/Downloads/cnpmcore/4.12.0/*.cpuprofile

# Find hotspots
node hotspot-finder.js ~/Downloads/cnpmcore/4.12.0/*.cpuprofile --top=30

# Filter by pattern
node hotspot-finder.js ~/Downloads/cnpmcore/4.12.0/*.cpuprofile --filter=leoric

# Analyze call tree to specific target
node call-tree-analyzer.js ~/Downloads/cnpmcore/4.12.0/*.cpuprofile --target=Bone

# Convert to flamegraph format
node flamegraph-convert.js ~/Downloads/cnpmcore/4.12.0/*.cpuprofile > stacks.txt
# Then use: cat stacks.txt | flamegraph.pl > flamegraph.svg
```

---

## Conclusion

The v4.12.0 profile shows that Leoric ORM's Bone constructor and structuredClone are the primary CPU bottlenecks, consuming over 11% of active CPU time combined. The recent Leoric optimization in v2.14.0 (PR #919: `feat: avoids Bone constructor overhead for each row`) should significantly reduce this overhead when upgraded.

Application code itself only consumes 4.58% of active CPU time, indicating good code efficiency. The majority of CPU time is spent in framework and ORM operations, which is typical for database-heavy applications.
