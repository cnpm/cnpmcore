# Heapdump Analysis: registry.npmmirror.com

**File**: `registry.npmmirror.com-08-x-heapdump-1116215-20250709-0`
**Date**: 2025-07-09 (snapshot), analyzed 2025-12-07
**Size**: 97.8 MB file, 136.68 MB heap

---

## Executive Summary

The heap snapshot shows a **136.68 MB** total self-size with **882,434 objects** and **4.3 million edges**. The memory distribution is:

| Category | Size | % of Heap |
|----------|------|-----------|
| Arrays | 50.56 MB | 37.0% |
| Strings | 31.60 MB | 23.1% |
| Code | 28.21 MB | 20.6% |
| Objects | 10.74 MB | 7.9% |
| Other | 15.57 MB | 11.4% |

---

## Key Findings

### 1. Large Anonymous Arrays (32 MB)

Four anonymous arrays of **8 MB each** dominate memory:

| ID | Size |
|----|------|
| 1211245 | 8.00 MB |
| 1211247 | 8.00 MB |
| 1211249 | 8.00 MB |
| 1211251 | 8.00 MB |

**Investigation needed**: These consecutive IDs suggest they're related. Could be:
- Package manifest caches
- Binary sync buffers
- Database connection pools
- Module dependency trees

### 2. String Memory (31.60 MB)

| Length Bucket | Count | Size |
|---------------|-------|------|
| <100 chars | 187,344 | 8.35 MB |
| 100-1K | 3,188 | 2.37 MB |
| 1K-10K | 1,751 | 9.91 MB |
| 10K-100K | 208 | 9.11 MB |
| >100K | 6 | 1.86 MB |

**Key Observations**:
- 6 very large strings (>100K chars) = 1.86 MB - likely package manifests or configs
- 208 large strings (10K-100K) = 9.11 MB - package versions, README content
- Most strings are small but add up to 8.35 MB

### 3. Code Memory (28.21 MB)

215,679 code objects consuming 28.21 MB indicates:
- Many loaded modules
- Compiled function bodies
- Could benefit from lazy loading

### 4. cnpmcore-Specific Patterns

| Category | Count | Size |
|----------|-------|------|
| Package entities | 13,063 | 6.42 MB |
| HTTP contexts | 21,652 | 6.12 MB |
| Buffers | 2,800 | 4.93 MB |
| Closures | 52,055 | 2.89 MB |
| Promises | 3,774 | 0.17 MB |
| Bone instances | 182 | 0.01 MB |

**Observations**:
- **13K Package entities** (6.42 MB) - significant cache
- **21K HTTP contexts** (6.12 MB) - many request contexts retained
- **52K Closures** (2.89 MB) - function closures from callbacks
- **182 Bone instances** (0.01 MB) - surprisingly low, may indicate good cleanup

### 5. Object Shape Overhead (6.53 MB)

75,747 object shapes consuming 6.53 MB. This is V8's hidden class mechanism. High count suggests:
- Many different object shapes in code
- Could benefit from consistent object initialization order

---

## Top Memory Consumers by Constructor

| Rank | Constructor | Count | Size | Analysis |
|------|-------------|-------|------|----------|
| 1 | (anonymous) | 32,610 | 35.78 MB | Arrays, closures |
| 2 | (object elements) | 38,658 | 9.16 MB | Array elements |
| 3 | (object properties) | 17,637 | 6.17 MB | Object properties |
| 4 | Mapping | 65,298 | 4.48 MB | Router/registry mappings |
| 5 | Object | 52,574 | 2.13 MB | Plain objects |
| 6 | Array | 44,866 | 1.37 MB | Array instances |
| 7 | system / Context | 13,084 | 0.73 MB | V8 contexts |
| 8 | native_bind | 8,684 | 0.40 MB | Bound functions |
| 9 | Module | 2,493 | 0.29 MB | ES modules |
| 10 | SemVer | 922 | 0.09 MB | Version objects |

### Notable Patterns

- **65K Mapping objects** (4.48 MB) - likely router layer mappings
- **922 SemVer** + **925 Comparator** objects - version parsing cache
- **2,493 Module** objects - loaded npm modules
- **240 MysqlAttribute** objects - ORM attribute definitions

---

## Potential Memory Leaks

### Detached Objects

| Type | Name | Size |
|------|------|------|
| native | TLSWrap | 464 bytes |
| native | Http2State | 424 bytes |
| native | BindingData | 296 bytes |
| native | ChannelWrap | 144 bytes |
| synthetic | SecureContext | 136 bytes |
| native | ConnectionsList | 128 bytes |
| native | ModuleWrap (x12) | 112 bytes each |

**Analysis**:
- TLSWrap/SecureContext - TLS connection artifacts
- Http2State - HTTP/2 connection state
- ModuleWrap - detached ES module wrappers

These are relatively small (~2KB total) and may be transient.

---

## Memory Optimization Recommendations

### Priority 1: Investigate Large Arrays (32 MB potential savings)

```javascript
// Find what's in the 8MB arrays
// Likely candidates:
// - PackageManifest caches
// - Binary sync queues
// - Route tables
```

**Action**: Add logging to track large array allocations.

### Priority 2: String Optimization (up to 10 MB savings)

1. **Large strings (>10K)**:
   - Consider streaming for package manifests
   - Compress cached content
   - Use lazy loading

2. **Repeated strings**:
   ```javascript
   // Use string interning for common values
   const internedStrings = new Map();
   function intern(str) {
     if (!internedStrings.has(str)) {
       internedStrings.set(str, str);
     }
     return internedStrings.get(str);
   }
   ```

### Priority 3: HTTP Context Cleanup

21,652 HTTP contexts is high. Ensure:
- Request contexts are properly garbage collected
- No references held after response completes
- Middleware doesn't retain context references

### Priority 4: Closure Reduction

52,055 closures (2.89 MB). Consider:
- Using class methods instead of inline closures
- Hoisting repeated callback functions
- Arrow function optimization

### Priority 5: Package Entity Caching

13,063 Package entities (6.42 MB):
- Implement LRU cache with size limits
- Use WeakRef for optional caching
- Consider TTL-based expiration

---

## Comparison with CPU Profile

| Metric | CPU Profile | Heap Snapshot | Correlation |
|--------|-------------|---------------|-------------|
| Bone instances | High CPU (1.19%) | Low memory (182 objects) | Fast allocation/GC |
| Package entities | Moderate CPU | High memory (13K) | Cache efficiency |
| Closures | Moderate CPU | High count (52K) | Function overhead |

The low Bone instance count in heap vs high CPU usage suggests:
- Bones are created/destroyed rapidly
- Good garbage collection
- Memory churn causing CPU overhead

---

## Monitoring Recommendations

1. **Track heap size over time**
   ```javascript
   setInterval(() => {
     const usage = process.memoryUsage();
     console.log('Heap:', (usage.heapUsed / 1024 / 1024).toFixed(2), 'MB');
   }, 60000);
   ```

2. **Monitor large array allocations**

3. **Add memory budget alerts**
   - Warn at 150 MB heap
   - Critical at 200 MB heap

4. **Regular heap snapshots**
   - Compare snapshots over time
   - Detect memory growth patterns

---

## Summary

| Finding | Impact | Priority |
|---------|--------|----------|
| 4x 8MB anonymous arrays | 32 MB | P0 - Investigate |
| Large strings (>10K) | 19 MB | P1 - Optimize |
| Package entity cache | 6.4 MB | P2 - Add limits |
| HTTP contexts | 6.1 MB | P2 - Verify cleanup |
| Closures | 2.9 MB | P3 - Reduce count |

**Total Potential Savings**: 30-40 MB (22-29% of heap)

---

*Analysis generated for registry.npmmirror.com production heapdump*
