# CPU Profile Analysis: registry.npmmirror.com (Feb 2025 - High Load)

**Profile**: `registry.npmmirror.com-02-x-cpuprofile-2645570-20250228-0.cpuprofile`
**Date**: 2025-02-28
**Size**: 5.5 MB (7,666 nodes, 157,965 total hits)

---

## Executive Summary

This is a **HIGH LOAD profile** with only **13.33% idle time** (vs 87-97% in other profiles). This represents peak production load and reveals the true performance bottlenecks.

### CPU Distribution (Active Time = 86.67%)

| Category | Hits | % of Total | % of Active Time |
|----------|------|------------|------------------|
| **Leoric ORM** | 26,362 | **16.69%** | 19.3% |
| **MySQL Driver** | 14,225 | **9.01%** | 10.4% |
| **Tegg Runtime** | 9,531 | **6.03%** | 7.0% |
| **GC** | 5,410 | **3.42%** | 3.9% |
| **Tegg Lifecycle** | 4,812 | **3.05%** | 3.5% |
| **Async Hooks** | 2,129 | **1.35%** | 1.6% |
| **Router** | 2,294 | **1.45%** | 1.7% |

---

## Critical Finding: Leoric ORM is the #1 Bottleneck

### Bone Constructor: 5.59% of Total CPU

The `Bone` constructor alone consumes **8,838 hits (5.59%)** - this is the single largest application-level hotspot.

**Comparison Across Profiles**:

| Profile | Date | Load | Bone Hits | Bone % |
|---------|------|------|-----------|--------|
| registry-02 (this) | Feb 2025 | High (87%) | 8,838 | **5.59%** |
| registry-07 | Dec 2025 | Medium (13%) | 1,995 | 1.19% |
| Profile 01/02 | Dec 2025 | Low (2-3%) | 407-658 | 0.24-0.39% |

**Conclusion**: Under high load, Bone constructor becomes the dominant bottleneck.

### Full Leoric Breakdown (16.69% total)

| Function | Hits | % | Location |
|----------|------|---|----------|
| `Bone` constructor | 8,838 | 5.59% | bone.js:142 |
| `isLogicalCondition` | 2,203 | 1.39% | query_object.js:102 |
| `ignite` | 1,270 | 0.80% | spell.js:441 |
| `token` | 1,217 | 0.77% | expr.js:266 |
| `query` | 1,213 | 0.77% | mysql/index.js:68 |
| `dispatch` | 989 | 0.63% | collection.js:77 |
| `Spell` | 971 | 0.61% | spell.js:325 |
| Other | ~9,461 | 5.99% | various |

### Hot Path Analysis

```
processTicksAndRejections (task_queues:67)
└── runMicrotasks (5,303 hits)
    └── ignite (spell.js:441)
        └── init (collection.js:13)
            └── dispatch (collection.js:77) [989 hits]
                └── instantiate (bone.js:1269)
                    └── ContextModelClass (SingletonModelObject.js:15)
                        └── Bone (bone.js:142) [8,838 hits]
```

---

## MySQL Driver Overhead (9.01%)

| Function | Hits | % | Analysis |
|----------|------|---|----------|
| `get` (column_definition) | 3,671 | 2.32% | Column metadata parsing |
| `keyFromFields` | 2,021 | 1.28% | Parser cache key generation |
| `start` (query) | 1,864 | 1.18% | Query execution start |
| `createQuery` | 1,664 | 1.05% | Query object creation |
| `parseDateTime` | 514 | 0.33% | DateTime parsing |

**Observation**: MySQL driver overhead is significant (9%). Consider:
- Connection pooling optimization
- Prepared statement caching
- Reducing query count per request

---

## Tegg Runtime Overhead (9.08% combined)

### Tegg Runtime (6.03%)

| Function | Hits | % |
|----------|------|---|
| `initWithInjectProperty` | 1,265 | 0.80% |
| `init` (ContextInitiator) | 1,115 | 0.71% |
| `getOrCreateEggObject` | 1,085 | 0.69% |
| `injectProperty` | 1,005 | 0.64% |

### Tegg Lifecycle (3.05%)

| Function | Hits | % |
|----------|------|---|
| `getLifecycleHook` | 1,503 | 0.95% |

**Observation**: Dependency injection overhead is significant under load.

---

## Garbage Collection (3.42%)

5,410 hits on GC is high, directly correlating with:
- High Bone object allocation (8,838 instances)
- Many short-lived objects from DI framework
- String allocations from MySQL parsing

---

## Async Hooks Overhead (2.65% + 1.72% = 4.37%)

| Function | Hits | % |
|----------|------|---|
| `promiseInitHook` | 4,183 | 2.65% |
| `lookupPublicResource` | 2,713 | 1.72% |
| `_propagate` | 2,036 | 1.29% |

**Analysis**: Async hooks for tracing add ~4.37% overhead. Consider:
- Sampling mode for tracing in production
- Conditional hook activation

---

## Application Code Hotspots

### cnpmcore Business Logic (2.09%)

| Function | Hits | % | File |
|----------|------|---|------|
| `convertModelToEntity` | 535 | 0.34% | ModelConvertor.js:80 |
| `readDistBytesToJSON` | 438 | 0.28% | DistRepository.js:36 |
| `_listPackageFullOrAbbreviatedManifests` | 217 | 0.14% | PackageManagerService.js:779 |
| `plusPackageVersionCounter` | 209 | 0.13% | PackageManagerService.js:412 |
| `show` (controller) | 229 | 0.15% | ShowPackageController.js:27 |
| `download` (controller) | 174 | 0.11% | DownloadPackageVersionTar.js:35 |

### Other Notable Functions

| Function | Hits | % | Analysis |
|----------|------|---|----------|
| `delegates anonymous` | 948 | 0.60% | Koa context delegation |
| `lru.min get` | 551 | 0.35% | LRU cache lookups |
| `logDate` | 471 | 0.30% | Logging timestamp formatting |
| `GetOrCreateMetadataMap` | 414 | 0.26% | Reflect-metadata overhead |

---

## Comparison: Feb 2025 vs Dec 2025

| Metric | Feb 2025 (this) | Dec 2025 (registry-07) | Change |
|--------|-----------------|------------------------|--------|
| Idle % | 13.33% | 86.92% | -73.59% |
| Active % | **86.67%** | 13.08% | +73.59% |
| Leoric % | **16.69%** | 2.58% | +14.11% |
| MySQL % | **9.01%** | 0.62% | +8.39% |
| Tegg Runtime % | **9.08%** | 0.55% | +8.53% |
| GC % | **3.42%** | 0.84% | +2.58% |

**Leoric version difference**: 2.13.5 (Feb) vs 2.13.9 (Dec)

---

## Optimization Recommendations

### Priority 0: Leoric ORM (16.69% of CPU)

1. **Deploy PR #919** - Bone constructor optimization
   - Expected impact: 3-5% CPU reduction

2. **Reduce `isLogicalCondition` calls** (1.39%)
   - Cache query condition analysis
   - Optimize condition parsing

3. **Query batching**
   - Reduce number of individual queries
   - Use bulk operations where possible

### Priority 1: MySQL Driver (9.01% of CPU)

1. **Connection pool tuning**
   ```javascript
   // Current: likely default settings
   // Optimize:
   pool: {
     min: 10,
     max: 50,
     acquireTimeoutMillis: 30000,
     idleTimeoutMillis: 600000,
   }
   ```

2. **Prepared statements**
   - Cache frequently executed queries
   - Reduce `createQuery` overhead

3. **Column metadata caching**
   - `keyFromFields` (1.28%) generates cache keys
   - Pre-cache for known schemas

### Priority 2: Tegg Runtime (9.08% of CPU)

1. **Singleton optimization**
   - Reduce per-request object creation
   - Cache resolved dependencies

2. **Lifecycle hook optimization**
   - `getLifecycleHook` (0.95%) called frequently
   - Consider hook result caching

### Priority 3: Async Hooks (4.37% of CPU)

1. **Sampling mode**
   ```javascript
   // Only trace 10% of requests
   if (Math.random() < 0.1) {
     enableAsyncHooks();
   }
   ```

2. **Conditional tracing**
   - Disable in high-load scenarios
   - Use header-based activation

### Priority 4: Garbage Collection (3.42%)

1. **Object pooling for Bone instances**
2. **Reduce string allocations in MySQL parsing**
3. **Tune V8 GC settings**
   ```
   node --max-old-space-size=4096 --gc-interval=100
   ```

---

## Performance Budget

Based on this profile, recommended CPU budget per category:

| Category | Current | Target | Savings |
|----------|---------|--------|---------|
| Leoric ORM | 16.69% | 8% | 8.69% |
| MySQL Driver | 9.01% | 5% | 4.01% |
| Tegg Runtime | 9.08% | 5% | 4.08% |
| Async Hooks | 4.37% | 2% | 2.37% |
| GC | 3.42% | 2% | 1.42% |
| **Total Savings** | - | - | **20.57%** |

With these optimizations, active CPU could drop from 86.67% to ~66%, or handle **30% more traffic** at the same CPU.

---

## Action Items

| Priority | Action | Expected Impact | Effort |
|----------|--------|-----------------|--------|
| P0 | Deploy Leoric PR #919 | -3-5% CPU | Low |
| P0 | Profile after deployment | Validate | Low |
| P1 | Query batching | -2-3% CPU | Medium |
| P1 | Connection pool tuning | -1-2% CPU | Low |
| P2 | Tegg singleton caching | -2-3% CPU | Medium |
| P2 | Async hooks sampling | -2% CPU | Medium |
| P3 | GC tuning | -1% CPU | Low |

---

## Summary

This high-load profile reveals that under production pressure:

1. **Leoric ORM** becomes the dominant bottleneck (16.69%)
2. **MySQL driver** overhead is significant (9.01%)
3. **DI framework** (Tegg) adds notable overhead (9.08%)
4. **Async hooks** for tracing cost 4.37%
5. **GC pressure** from object churn costs 3.42%

**Total optimizable overhead**: ~42% of CPU time

With targeted optimizations, the system could handle 30-50% more traffic at the same hardware cost.

---

*Analysis generated for registry.npmmirror.com high-load production profile*
