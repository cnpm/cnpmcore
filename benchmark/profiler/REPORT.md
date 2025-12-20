# CPU Profile Analysis Report

- **Profile**: `x-cpuprofile-3000679-20251207-0.cpuprofile`
- **Date**: 2025-12-07
- **Duration**: 180.02 seconds (3 minutes)
- **Profile Type**: `xprofiler-cpu-profile`

## Executive Summary

This CPU profile was captured from a cnpmcore production instance. The profile shows the application is mostly idle (90% of the time), with about 6% active CPU usage during the 3-minute sampling period.

### Key Findings

1. **Leoric ORM is the #1 CPU consumer** - 24% of active CPU time is spent in leoric (ORM library)
2. **The `Bone` constructor is the main hotspot** - Taking 15.38% of active CPU time alone
3. **deep-equal operations in leoric are expensive** - Type checking functions (`is-string`, `is-number-object`, `is-array-buffer`) consume significant CPU
4. **Application code is very efficient** - Only 2.18% of CPU time is in application code

## CPU Time Distribution

| Category                | Samples | % of Total |
| ----------------------- | ------- | ---------- |
| Idle                    | 151,070 | 90.09%     |
| GC (Garbage Collection) | 4,888   | 2.91%      |
| Active/User Code        | 10,098  | 6.02%      |
| Program                 | 1,641   | 0.98%      |

## Active CPU Time Breakdown

| Category         | Samples | % of Active |
| ---------------- | ------- | ----------- |
| NPM Packages     | 4,085   | 40.45%      |
| Native/V8        | 2,975   | 29.46%      |
| Node.js Core     | 2,818   | 27.91%      |
| Application Code | 220     | 2.18%       |

## Top Performance Bottlenecks

### 1. Leoric ORM - `Bone` Constructor (15.38%)

The single biggest CPU consumer is the `Bone` constructor in leoric ORM.

**Location**: `node_modules/leoric@2.13.9@leoric/lib/bone.js:150`

**Call paths**:

- Database query results → `instantiate()` → `dispatch()` → `Bone()`
- Entity creation → `create()` → `Bone()`

**Recommendation**:

- Consider lazy instantiation for bulk queries
- Review if all Bone properties need to be initialized upfront
- Consider upgrading leoric if newer versions have optimizations

### 2. Deep Equality Checks in Leoric (2.5%)

The `changes()` function in leoric uses `deep-equal` which triggers expensive type checking:

| Function                    | Samples | %     |
| --------------------------- | ------- | ----- |
| tryStringObject (is-string) | 68      | 0.67% |
| isArrayBuffer               | 51      | 0.50% |
| tryNumberObject             | 45      | 0.45% |
| booleanBrandCheck           | 51      | 0.50% |
| isSharedArrayBuffer         | 37      | 0.37% |

**Recommendation**:

- Check if leoric has an option to skip change detection
- For bulk inserts, consider using raw SQL queries
- Review if `deep-equal` can be replaced with faster comparison

### 3. MySQL2 Driver (2.72%)

MySQL2 operations including result parsing:

| Function              | Samples | %     |
| --------------------- | ------- | ----- |
| column_definition.get | 56      | 0.55% |
| query.start           | 49      | 0.49% |
| keyFromFields         | 30      | 0.30% |

**Recommendation**:

- These are normal database operations - no immediate action needed
- Consider connection pooling optimization if not already configured

### 4. Network I/O (writev/writeBuffer) - 10.1%

Significant time spent in network I/O operations:

| Function             | Samples | %      |
| -------------------- | ------- | ------ |
| writev (native)      | 1,037   | 10.27% |
| writeBuffer (native) | 437     | 4.33%  |

**Recommendation**:

- This is expected for a registry that serves packages
- Consider response compression if not enabled
- Review if large payloads can be streamed

### 5. urllib JSON Parsing (0.31%)

**Location**: `node_modules/urllib@4.8.2@urllib/dist/esm/utils.js:25`

**Recommendation**:

- Normal operation for HTTP client responses
- Consider if some responses don't need JSON parsing

## Application Code Analysis

The application code is highly efficient. Top application hotspots:

| Function                 | File                        | Samples | %     |
| ------------------------ | --------------------------- | ------- | ----- |
| syncPackage              | PackageSearchService.js:16  | 22      | 0.22% |
| convertModelToEntity     | ModelConvertor.js:74        | 38      | 0.38% |
| syncPackageWithPackument | PackageSyncerService.js:926 | 14      | 0.14% |
| findBinary               | BinaryRepository.js:27      | 7       | 0.07% |

**Observation**: The application code is well-optimized. Most CPU time is in third-party dependencies.

## Recommendations Summary

### High Priority

1. **Investigate Leoric Bone Constructor**
   - This is consuming 15.38% of active CPU time
   - Check if leoric has batch instantiation options
   - Consider lazy loading of entity properties
   - Profile specific queries to identify the most expensive ones

2. **Review deep-equal Usage**
   - The `changes()` function triggers expensive type checks
   - For bulk operations, consider skipping change detection
   - Explore if leoric supports simpler comparison strategies

### Medium Priority

3. **GC Optimization**
   - GC is at 2.91% which is reasonable but could be improved
   - Review object allocation patterns in hot paths
   - Consider object pooling for frequently created objects

4. **Network I/O Review**
   - writev operations are expected but at 10% worth monitoring
   - Ensure response streaming is properly configured
   - Review large payload handling

### Low Priority

5. **Keep Application Code Lean**
   - Application code is only 2.18% of CPU - excellent
   - Continue following current coding patterns

## Tools Created

The following analysis scripts have been created in `benchmark/profiler/`:

1. **analyze-profile.js** - Comprehensive CPU profile analyzer

   ```bash
   node benchmark/profiler/analyze-profile.js path/to/profile.cpuprofile
   ```

2. **hotspot-finder.js** - Find specific hotspots with filtering

   ```bash
   node benchmark/profiler/hotspot-finder.js profile.cpuprofile --filter=leoric --top=20
   ```

3. **flamegraph-convert.js** - Convert to folded stack format for flame graphs
   ```bash
   node benchmark/profiler/flamegraph-convert.js profile.cpuprofile > stacks.txt
   ```

## Viewing the Profile

The `.cpuprofile` file can be viewed in:

1. **Chrome DevTools**: Open `chrome://inspect` → Open dedicated DevTools → Performance tab → Load
2. **speedscope.app**: Upload the file directly at https://www.speedscope.app/
3. **VS Code**: Install "vscode-js-profile-flame" extension

## Conclusion

The cnpmcore application is well-optimized with only 2.18% of CPU time in application code. The main optimization opportunity is in the leoric ORM layer, specifically the `Bone` constructor which consumes 15.38% of active CPU time. The GC time at 2.91% is reasonable for a Node.js application of this complexity.
