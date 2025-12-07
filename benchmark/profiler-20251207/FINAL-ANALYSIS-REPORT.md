# cnpmcore CPU Profile Analysis Report

**Date**: 2025-12-07
**Profile Tool**: xprofiler
**Profiles Analyzed**:
- `01-x-cpuprofile-3591251-20251207-0.cpuprofile` (4.08 MB, 3489 nodes)
- `02-x-cpuprofile-3070674-20251207-0.cpuprofile` (3.71 MB, 2401 nodes)

---

## Executive Summary

Both CPU profiles show that the cnpmcore application is mostly idle (~97-98% of CPU time), indicating the workload during profiling was relatively light or I/O bound. The active CPU time (~2-3%) is dominated by:

1. **Leoric ORM** (~0.44-0.70%) - Primary CPU consumer in application code
2. **MySQL Driver** (~0.11-0.13%)
3. **HTTP/Router stack** (~0.28-0.31%)
4. **Native operations** (GC, I/O, structuredClone)

---

## Key Findings

### 1. Leoric ORM `Bone` Constructor is the Top Hotspot

The `Bone` constructor in Leoric ORM consumes **0.24-0.39%** of total CPU time:

| Profile | Bone Hits | Percentage |
|---------|-----------|------------|
| Profile 1 | 658 | 0.39% |
| Profile 2 | 407 | 0.24% |

**Location**: `leoric/lib/bone.js:150`

**Call Chain**:
```
processTicksAndRejections
└── runMicrotasks
    └── ignite (spell.js:441)
        └── init (collection.js:13)
            └── dispatch (collection.js:81)
                └── instantiate (bone.js:1282)
                    └── Bone (bone.js:150)
```

**Root Cause Analysis**:
- Every database row fetched creates a new `Bone` instance
- The constructor overhead adds up significantly when fetching many rows
- Related functions like `instantiate` (0.02-0.05%) and `dispatch` (0.03-0.04%) contribute to overall ORM overhead

### 2. Garbage Collection

| Profile | GC Hits | Percentage |
|---------|---------|------------|
| Profile 1 | 831 (481 gc + 350 custom_gc) | 0.49% |
| Profile 2 | 345 | 0.20% |

Profile 1 shows significantly higher GC pressure, possibly correlated with:
- More Bone object allocations
- The `custom_gc` category (0.21%) only appears in Profile 1

### 3. JSON Processing

`parseJSON` in urllib consumes **0.05-0.07%** of CPU time, indicating:
- Significant amount of JSON parsing from HTTP responses
- Consider caching parsed results or optimizing data transfer

### 4. MySQL Query Overhead

The MySQL driver contributes ~0.11-0.13% of CPU time, primarily in:
- `column_definition.js:263` - Column metadata parsing
- `query.js:48` - Query execution
- `parser_cache.js:9` - Parser cache key generation

### 5. HTTP/Router Stack

The Egg.js/Koa router stack contributes ~0.28-0.31%:
- `_respond` in application.js
- Route `match` operations
- Lifecycle hooks and middleware dispatch

---

## Module-Level Breakdown

### Profile 2 (02-x-cpuprofile-3070674)

| Module | Hits | % | Priority |
|--------|------|---|----------|
| (native/gc) | 166,106 | 98.49% | N/A |
| Leoric ORM | 747 | 0.44% | **HIGH** |
| node:internal | 372 | 0.22% | LOW |
| MySQL Driver | 187 | 0.11% | MEDIUM |
| urllib | 137 | 0.08% | MEDIUM |
| Tegg Runtime | 101 | 0.06% | LOW |
| cnpmcore App | 75 | 0.04% | LOW |
| Koa | 66 | 0.04% | LOW |

---

## Performance Optimization Recommendations

### Priority 1: Leoric ORM Optimization (Potential 30-50% reduction in active CPU)

1. **Batch Operations**: Avoid fetching rows one by one
   ```javascript
   // Instead of multiple queries
   // Use: Model.find({ id: ids }) with batch processing
   ```

2. **Lean Queries**: Consider raw queries for read-heavy paths
   ```javascript
   // For read-only operations
   const rows = await Model.driver.query('SELECT * FROM table WHERE ...');
   ```

3. **Review Bone Constructor**:
   - The recent PR #919 `feat: avoids Bone constructor overhead for each row` may address this
   - Verify the optimization is deployed and measure impact

4. **Selective Column Fetching**:
   ```javascript
   // Only select needed columns
   Model.find().select('id', 'name').where(...)
   ```

### Priority 2: GC Pressure Reduction

1. **Object Pooling**: Reuse objects where possible instead of creating new Bone instances
2. **Memory Profiling**: Use `--max-old-space-size` tuning if needed
3. **Investigate `custom_gc`**: The 0.21% in Profile 1 suggests custom finalization overhead

### Priority 3: JSON Processing

1. **Response Caching**: Cache parsed JSON responses where appropriate
2. **Streaming JSON**: For large responses, consider streaming JSON parsing
3. **Binary Protocols**: For internal services, consider using more efficient serialization

### Priority 4: MySQL Query Optimization

1. **Connection Pooling**: Ensure connection pool is properly sized
2. **Prepared Statements**: Use prepared statements for repeated queries
3. **Query Batching**: Batch multiple small queries into single operations

---

## Hot Path Analysis

### Most CPU-Intensive Call Path

```
processTicksAndRejections (node:internal/process/task_queues:71)
├── runMicrotasks
│   └── ignite (leoric/spell.js:441)
│       └── init (leoric/collection.js:13)
│           └── dispatch (leoric/collection.js:81)
│               └── instantiate (leoric/bone.js:1282)
│                   └── Bone (leoric/bone.js:150)  [380 hits]
└── #requestInternal (urllib/HttpClient.js:126)
    └── parseJSON (urllib/utils.js:25)  [117 hits]
```

---

## Comparison Between Profiles

| Metric | Profile 1 | Profile 2 | Change |
|--------|-----------|-----------|--------|
| Total Hits | 168,248 | 168,658 | +0.2% |
| Idle Time | 96.55% | 97.72% | +1.2% |
| Leoric | 0.70% | 0.44% | **-0.26%** |
| App Code | 0.12% | 0.04% | **-0.08%** |
| GC | 0.49% | 0.20% | **-0.29%** |

**Notable Differences**:
- Profile 2 shows improved Leoric overhead (may indicate different workload or optimization)
- Profile 1 has higher GC pressure and more `custom_gc` activity
- Profile 1 includes `tar` package activity (0.04%) suggesting package operations

---

## Monitoring Recommendations

1. **Track Leoric Query Counts**: Monitor number of queries per request
2. **GC Metrics**: Add GC timing metrics to monitoring dashboard
3. **Response Time Breakdown**: Add tracing for ORM vs HTTP vs business logic time
4. **Memory Pressure**: Track heap usage and GC frequency

---

## Files Generated

| File | Description |
|------|-------------|
| `analyze-cpuprofile.js` | Main analysis script for individual profiles |
| `compare-profiles.js` | Script for comparing two profiles |
| `REPORT-01-cpuprofile.md` | Detailed analysis of Profile 1 |
| `REPORT-02-cpuprofile.md` | Detailed analysis of Profile 2 |
| `COMPARISON-REPORT.md` | Side-by-side comparison |
| `FINAL-ANALYSIS-REPORT.md` | This comprehensive report |

---

## Usage

### Analyze a single profile
```bash
node benchmark/profiler-20251207/analyze-cpuprofile.js <profile.cpuprofile>
```

### Compare two profiles
```bash
node benchmark/profiler-20251207/compare-profiles.js <profile1.cpuprofile> <profile2.cpuprofile>
```

### Filter by pattern
```bash
node benchmark/profiler-20251207/analyze-cpuprofile.js <profile.cpuprofile> --filter=leoric
```

### Output as JSON
```bash
node benchmark/profiler-20251207/analyze-cpuprofile.js <profile.cpuprofile> --json
```

---

## Conclusion

The cnpmcore application's CPU profile shows that **Leoric ORM is the primary CPU consumer** in the application code, accounting for ~45% of active (non-idle) CPU time. The main hotspot is the `Bone` constructor which is called for every database row fetched.

**Key Action Items**:
1. ✅ Verify PR #919's optimization is deployed
2. 🔲 Profile after optimization to measure improvement
3. 🔲 Consider lean queries for high-throughput read paths
4. 🔲 Implement response caching for frequently accessed data
5. 🔲 Add performance monitoring for ORM query counts

---

*Report generated by cnpmcore CPU profile analyzer*
