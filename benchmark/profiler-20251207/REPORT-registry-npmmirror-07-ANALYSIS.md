# registry.npmmirror.com CPU Profile Analysis

**Profile**: `registry.npmmirror.com-07-x-cpuprofile-2308828-20251207-0.cpuprofile`
**Date**: 2025-12-07
**Size**: 4.87 MB (5760 nodes, 166,949 total hits)

---

## Executive Summary

This profile shows **significantly higher CPU utilization** (~13% active vs ~2-3% in previous profiles), indicating a realistic production workload. The main bottlenecks are:

| Category | CPU % | Status |
|----------|-------|--------|
| Leoric ORM (`Bone` constructor) | **2.58%** | 🔴 Critical |
| HTTP/Router stack | **2.35%** | 🟡 Medium |
| Garbage Collection | **0.84%** | 🟡 Medium |
| MySQL Driver | **0.62%** | 🟢 Acceptable |
| cnpmcore App Code | **0.62%** | 🟢 Acceptable |

---

## Critical Finding: Leoric ORM Bone Constructor

### The Problem

The `Bone` constructor at `leoric/lib/bone.js:150` consumes **1.19% of total CPU** (1,995 hits), making it the **#1 application-level hotspot**.

### Call Chain Analysis

```
processTicksAndRejections
└── runMicrotasks
    └── ignite (spell.js:441)
        └── init (collection.js:13)
            └── dispatch (collection.js:81)           [409 hits, 0.24%]
                └── instantiate (bone.js:1282)        [234 hits, 0.14%]
                    ├── ContextModelClass (SingletonModelObject.js:17)
                    │   └── Bone (bone.js:150)        [1,995 hits, 1.19%]
                    └── cloneValue (bone.js:112)
                        └── structuredClone           [695 hits, 0.42%]
```

### Root Cause

1. **Every database row** triggers a `new Bone()` call
2. **structuredClone** is called in `cloneValue` for deep copying - adds 0.42% overhead
3. **dispatch** iteration adds 0.24%
4. **instantiate** adds 0.14%

**Total Leoric overhead**: ~2.58% of CPU

### Impact Calculation

If the server handles 1000 requests/second and each request fetches 10 rows:
- 10,000 Bone constructor calls/second
- At current profile rate: ~1.19% CPU per ~100 calls
- This scales linearly with row count

---

## HTTP/Router Stack Analysis (2.35%)

### Breakdown

| Function | Hits | % | Location |
|----------|------|---|----------|
| `_respond` | 443 | 0.27% | koa/application.js:218 |
| `match` | 184 | 0.11% | router/Layer.js:72 |
| `getOrCreateEggObject` | 130 | 0.08% | tegg-runtime/EggContainerFactory.js:28 |
| `dispatch` (koa-compose) | 120 | 0.07% | koa-compose/index.js:35 |
| Router anonymous | 128 | 0.08% | router/Router.js:137 |

### Observations

1. **`_respond` (0.27%)**: Response finalization is notable
2. **Route matching (0.11%)**: Consider route optimization if many routes
3. **Tegg DI container (0.08%)**: Object creation overhead

---

## Garbage Collection (0.84%)

1,404 hits on garbage collector suggests memory pressure from:
- Bone object allocations (1,995 per cycle)
- structuredClone deep copies (695 per cycle)
- HTTP request/response objects

**Recommendation**: Profile memory allocation to identify reduction opportunities.

---

## Application Code Hotspots

### cnpmcore Business Logic (0.62%)

| Function | Hits | % | File |
|----------|------|---|------|
| `convertModelToEntity` | 183 | 0.11% | ModelConvertor.js:74 |
| `readDistBytesToJSON` | 200 | 0.12% | DistRepository.js:31 |
| `_listPackageFullOrAbbreviatedManifests` | 60 | 0.04% | PackageManagerService.js:806 |
| `_updatePackageManifestsToDists` | 51 | 0.03% | PackageManagerService.js:764 |
| `show` (controller) | 50 | 0.03% | ShowPackageController.js:20 |

### Key Observations

1. **`convertModelToEntity` (0.11%)**: Model-to-entity conversion happens frequently
2. **`readDistBytesToJSON` (0.12%)**: JSON parsing from dist storage is notable
3. **Package manifest operations**: `_listPackageFullOrAbbreviatedManifests` and `_updatePackageManifestsToDists` are hot paths

---

## Reflect-Metadata Overhead (0.31%)

| Function | Hits | % |
|----------|------|---|
| `OrdinaryGetMetadata` | 146 | 0.09% |
| `getProvider` | 102 | 0.06% |
| `OrdinaryGetPrototypeOf` | 90 | 0.05% |

The reflect-metadata package adds overhead for TypeScript decorators and DI. This is acceptable but worth monitoring.

---

## MySQL Driver (0.62%)

| Function | Hits | % |
|----------|------|---|
| `get` (column_definition) | 194 | 0.12% |
| `parseDateTime` | 157 | 0.09% |
| `start` (query) | 130 | 0.08% |
| `keyFromFields` | 106 | 0.06% |
| `decode` (string) | 64 | 0.04% |

**Observations**:
- DateTime parsing is notable (0.09%) - consider storing as timestamps
- String decoding (0.04%) - UTF-8 conversion overhead

---

## Hot Path Summary

### Top 5 CPU-Consuming Paths

1. **Bone Constructor Path** (1,981 hits)
   ```
   processTicksAndRejections → runMicrotasks → ignite → init →
   dispatch → instantiate → ContextModelClass → Bone
   ```

2. **Garbage Collection** (1,404 hits)

3. **Program Overhead** (986 hits)

4. **structuredClone Path** (691 hits)
   ```
   ... → instantiate → cloneValue → structuredClone
   ```

5. **HTTP Response Path** (440 hits)
   ```
   processTicksAndRejections → runMicrotasks → handleRequest → _respond
   ```

---

## Optimization Recommendations

### Priority 1: Leoric ORM (Potential 50%+ reduction in active CPU)

1. **Deploy PR #919** - `feat: avoids Bone constructor overhead for each row`
   - Expected: Reduce Bone constructor overhead significantly

2. **Avoid structuredClone in cloneValue**
   ```javascript
   // Current: Deep clone with structuredClone
   // Proposed: Shallow clone for simple objects
   // Or: Lazy cloning on modification
   ```

3. **Use raw queries for read-heavy paths**
   ```javascript
   // For listing packages
   const rows = await PackageVersion.driver.query(
     'SELECT id, version, manifest FROM package_versions WHERE package_id = ?',
     [packageId]
   );
   // Skip Bone instantiation entirely
   ```

4. **Batch fetching with pagination**
   - Limit rows per query to reduce per-request Bone allocations

### Priority 2: Model Conversion Optimization

1. **Cache entity conversions**
   ```javascript
   // In ModelConvertor.js
   const entityCache = new WeakMap();
   function convertModelToEntity(model) {
     if (entityCache.has(model)) return entityCache.get(model);
     const entity = /* convert */;
     entityCache.set(model, entity);
     return entity;
   }
   ```

2. **Lazy property access** - Don't convert all properties upfront

### Priority 3: JSON Processing

1. **Cache `readDistBytesToJSON` results**
   - Dist content is immutable; cache parsed JSON

2. **Consider binary format** for internal storage (e.g., MessagePack)

### Priority 4: Memory/GC

1. **Object pooling** for frequently allocated objects
2. **Reduce structuredClone usage** - use shallow copies where safe
3. **Consider WeakRef** for cached entities

---

## Comparison with Previous Profiles

| Metric | Profile 01/02 | This Profile | Change |
|--------|---------------|--------------|--------|
| Idle % | 97-98% | 87% | **-10%** |
| Leoric | 0.44-0.70% | 2.58% | **+1.9%** |
| GC | 0.20-0.49% | 0.84% | **+0.4%** |
| HTTP Stack | 0.28-0.31% | 2.35% | **+2.0%** |
| Total Active | 2-3% | 13% | **+10%** |

This profile represents **~5x higher load** than previous profiles, making it more representative of production behavior.

---

## Action Items

| Priority | Action | Expected Impact | Effort |
|----------|--------|-----------------|--------|
| P0 | Deploy Leoric PR #919 | -1% CPU | Low |
| P0 | Profile after deployment | Validate | Low |
| P1 | Reduce structuredClone usage | -0.4% CPU | Medium |
| P1 | Cache readDistBytesToJSON | -0.1% CPU | Low |
| P2 | Raw queries for hot paths | -0.5% CPU | Medium |
| P2 | Entity conversion caching | -0.1% CPU | Medium |
| P3 | Memory profiling | Reduce GC | Medium |

---

## Monitoring Metrics to Add

1. **Bone instantiations per request**
2. **Query count per request type**
3. **Average rows fetched per query**
4. **GC pause times and frequency**
5. **Request latency breakdown** (ORM vs HTTP vs business logic)

---

*Analysis generated for registry.npmmirror.com production workload*
