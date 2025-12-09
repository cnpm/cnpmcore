# CPU Profile Analysis Report - cnpmcore v4.14.0

## Profile Information

| Property | Value |
|----------|-------|
| **File** | registry-npmmirror-x-cpuprofile-870954-20251209-0.cpuprofile |
| **Type** | xprofiler-cpu-profile |
| **Total Nodes** | 4,723 |
| **Total Samples** | 165,976 |
| **Analysis Date** | 2025-12-09 |

---

## Executive Summary

### CPU Utilization Overview

| Metric | Samples | Percentage |
|--------|---------|------------|
| **Total Samples** | 165,976 | 100% |
| **Idle Time** | 126,293 | 76.09% |
| **Active CPU Time** | 39,683 | 23.91% |
| **Real Active Time** (excl. GC/program) | 33,819 | 20.38% |

The application is **I/O bound** with 76% idle time, indicating the system is waiting for database queries, network I/O, or other async operations. The actual CPU work is distributed across framework overhead, ORM operations, and application code.

### Key Findings

1. **Leoric ORM** consumes **15.2%** of active CPU time, with the `Bone` constructor being the top single function (4.65%)
2. **Egg/Tegg framework** overhead accounts for **27.3%** of active CPU time (routing, DI, lifecycle)
3. **Request routing** (`Layer.match`, `Router.dispatch`) takes **10.1%** of active CPU
4. **Application code** (cnpmcore) only uses **4.47%** of active CPU - very efficient

---

## Active CPU Breakdown (Excluding Idle)

When we exclude idle time and focus on actual CPU work:

| Category | Samples | % of Active CPU | Top Function |
|----------|---------|-----------------|--------------|
| egg/tegg | 9,231 | 27.30% | `match` (Layer.js) |
| node internals | 7,526 | 22.25% | `nextTick` |
| leoric (ORM) | 5,139 | 15.20% | `Bone` constructor |
| V8/native (other) | 4,788 | 14.16% | `writev` |
| mysql2 (driver) | 2,201 | 6.51% | `get` (column_definition) |
| cnpmcore (app) | 1,511 | 4.47% | `plusPackageVersionCounter` |
| koa/router | 557 | 1.65% | `dispatch` |
| reflect-metadata | 487 | 1.44% | `getProvider` |

---

## Top 20 Active Functions

| Rank | Function | Location | Samples | % Active |
|------|----------|----------|---------|----------|
| 1 | `Bone` | leoric/bone.js:150 | 1,574 | 4.65% |
| 2 | `nextTick` | node:task_queues:111 | 1,022 | 3.02% |
| 3 | `writev` | (native) | 914 | 2.70% |
| 4 | `match` | @eggjs/router/Layer.js:72 | 695 | 2.06% |
| 5 | `_addHeaderLine` | node:_http_incoming:382 | 619 | 1.83% |
| 6 | `get` | mysql2/column_definition.js:263 | 619 | 1.83% |
| 7 | `writeUtf8String` | (native) | 585 | 1.73% |
| 8 | `(anonymous)` | @eggjs/router/Router.js:137 | 483 | 1.43% |
| 9 | `writeBuffer` | (native) | 469 | 1.39% |
| 10 | `structuredClone` | (native) | 421 | 1.24% |
| 11 | `(anonymous)` | HTTPMethodRegister.js:160 | 401 | 1.19% |
| 12 | `injectProperty` | tegg-runtime/EggObjectImpl.js:165 | 376 | 1.11% |
| 13 | `start` | mysql2/query.js:48 | 349 | 1.03% |
| 14 | `initWithInjectProperty` | tegg-runtime/EggObjectImpl.js:20 | 344 | 1.02% |
| 15 | `token` | leoric/expr.js:266 | 337 | 1.00% |
| 16 | `dispatch` | koa-compose/index.js:35 | 333 | 0.98% |
| 17 | `getLifecycleHook` | @eggjs/lifecycle/LifycycleUtil.js:72 | 330 | 0.98% |
| 18 | `init` | tegg-runtime/ContextInitiator.js:13 | 329 | 0.97% |
| 19 | `dispatch` | leoric/collection.js:81 | 318 | 0.94% |
| 20 | `getOrCreateEggObject` | tegg-runtime/EggContainerFactory.js:28 | 314 | 0.93% |

---

## Hot Path Analysis

### Hot Path 1: ORM Result Instantiation (1,568 samples, 4.64%)

```
processTicksAndRejections
  → runMicrotasks
    → ignite (spell.js:441)
      → init (collection.js:13)
        → dispatch (collection.js:81)
          → instantiate (bone.js:1282)
            → ContextModelClass (SingletonModelObject.js:17)
              → Bone (bone.js:150)
```

**Analysis**: This is the most significant CPU consumer. Every database query result row triggers the `Bone` constructor through the `instantiate` method. The overhead comes from:
- Creating new model instances for each row
- Setting up getters/setters
- Initializing internal state

### Hot Path 2: HTTP Response Writing (900 samples, 2.66%)

```
end (node:_http_outgoing)
  → Writable.uncork
    → clearBuffer
      → doWrite
        → Socket._writev
          → writevGeneric
            → writev (native)
```

**Analysis**: Network I/O for sending HTTP responses. This is expected overhead.

### Hot Path 3: Request Routing (695 samples, 2.06%)

```
processTicksAndRejections
  → runMicrotasks
    → ctxLifecycleMiddleware
      → dispatch (koa-compose)
        → dispatch (Router.js)
          → match (Router.js)
            → match (Layer.js)
```

**Analysis**: Route matching for each request. With many routes, this can add up.

---

## Overhead Breakdown

| Component | Samples | % of Active CPU | Notes |
|-----------|---------|-----------------|-------|
| **ORM (Leoric)** | 5,139 | 15.20% | `Bone` constructor dominates |
| **Tegg/DI** | 4,209 | 12.45% | Property injection, lifecycle |
| **Request Routing** | 3,431 | 10.15% | Layer matching, dispatch chain |
| **Database Driver** | 2,550 | 7.54% | mysql2 packet parsing |

---

## cnpmcore Application Code Analysis

The application code itself is very efficient, consuming only 4.47% of active CPU:

| Function | Samples | % | Location |
|----------|---------|---|----------|
| `plusPackageVersionCounter` | 189 | 0.56% | PackageManagerService.js:414 |
| `download` | 99 | 0.29% | DownloadPackageVersionTar.js:26 |
| `beforeCall` | 94 | 0.28% | AsyncTimer.js:17 |
| `teggRootProto` | 94 | 0.28% | tegg_root_proto.js:3 |
| `siteFile` | 77 | 0.23% | site_file.js:6 |
| `afterFinally` | 65 | 0.19% | AsyncTimer.js:24 |
| `plus` | 65 | 0.19% | PackageVersionDownloadRepository.js:13 |
| `savePackageVersionCounters` | 58 | 0.17% | PackageManagerService.js:435 |

---

## Optimization Recommendations

### 1. [HIGH PRIORITY] Optimize Leoric ORM Usage

**Impact**: Could reduce 15% of active CPU time

The `Bone` constructor is called for every database row returned. Options:
- ✅ **Already optimized in v4.14.0**: According to PR #919, Leoric 2.13.9 avoids Bone constructor overhead
- Consider using raw queries for bulk read operations where full model instances aren't needed
- Use `Model.find().raw()` for read-only operations when model methods aren't needed

### 2. [MEDIUM PRIORITY] Tegg/DI Overhead

**Impact**: Could reduce 12% of active CPU time

Per-request dependency injection adds overhead:
- `injectProperty`: 1.11% of active CPU
- `initWithInjectProperty`: 1.02% of active CPU
- `getOrCreateEggObject`: 0.93% of active CPU

Suggestions:
- Use singleton scope for stateless services where possible
- Reduce the number of injected dependencies per request
- Consider lazy injection for rarely-used dependencies

### 3. [MEDIUM PRIORITY] Router Optimization

**Impact**: Could reduce 10% of active CPU time

Route matching (`Layer.match`) takes significant CPU:
- Consider route ordering (most frequent routes first)
- Reduce the number of registered routes if possible
- Use route prefixes to create efficient matching trees

### 4. [LOW PRIORITY] Reduce structuredClone Usage

**Impact**: ~1.24% of active CPU

`structuredClone` is being called frequently. Consider:
- Using shallow copies when deep cloning isn't needed
- Caching cloned objects when safe to do so

---

## Comparison Notes

### deep-equal Library (Previously a Concern)

In this profile, `deep-equal` consumes only **0.00%** of CPU (3 samples). This suggests:
- The optimization in PR #919 (avoiding Bone constructor overhead) has significantly reduced deep-equal calls
- The change detection mechanism is no longer a bottleneck

### Garbage Collection

GC uses **1,219 samples (3.6% of active CPU)** which is acceptable for a Node.js application handling many requests.

---

## Files Generated

| File | Description |
|------|-------------|
| `analyze-cpuprofile.mjs` | Main CPU profile analyzer script |
| `analyze-bone.mjs` | Deep analysis of Bone constructor calls |
| `analyze-active-cpu.mjs` | Active CPU analysis (excluding idle) |
| `top-functions.json` | Top 100 functions by self time |
| `categories.json` | Functions grouped by source category |
| `hot-paths.json` | Top 50 hot call paths |
| `active-cpu-summary.json` | Summary of active CPU analysis |

---

## How to Use Analysis Scripts

```bash
# Run main analysis
node benchmark/profiler-4.14.0/analyze-cpuprofile.mjs [path-to-cpuprofile]

# Analyze Bone constructor specifically
node benchmark/profiler-4.14.0/analyze-bone.mjs [path-to-cpuprofile]

# Analyze active CPU (excluding idle)
node benchmark/profiler-4.14.0/analyze-active-cpu.mjs [path-to-cpuprofile]
```

---

## Conclusion

cnpmcore v4.14.0 shows a healthy CPU profile with:
- **76% idle time** (I/O bound, expected for a registry service)
- **Application code uses only 4.47%** of active CPU (efficient)
- **Main overhead** comes from framework (27%) and ORM (15%)

The `deep-equal` issue from previous versions appears to be resolved. The primary optimization opportunity now is in ORM instantiation and framework overhead, which are areas for upstream improvements in Leoric and Tegg rather than application code changes.

---

*Generated by cnpmcore CPU Profile Analyzer - 2025-12-09*
