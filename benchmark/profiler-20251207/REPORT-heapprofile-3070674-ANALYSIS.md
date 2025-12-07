# Heap Allocation Profile Analysis

**File**: `x-heapprofile-3070674-20251207-1.heapprofile`
**Date**: 2025-12-07
**Total Allocations**: 71 sample points
**Total Size**: 54.10 MB

---

## Executive Summary

This heap allocation profile shows **where memory is being allocated** during runtime. The top allocators are:

| Category | Size | % | Priority |
|----------|------|---|----------|
| JSON Parsing | 11.04 MB | 20.40% | 🔴 High |
| HTTP/Koa (Tegg) | 9.00 MB | 16.64% | 🔴 High |
| Leoric ORM | 8.01 MB | 14.80% | 🔴 High |
| fast-xml-parser | 5.50 MB | 10.17% | 🟡 Medium |
| urllib | 6.04 MB | 11.16% | 🟡 Medium |

---

## Top Memory Allocators

### 1. JSON Parsing (20.40% = 11.04 MB)

| Function | Size | Source |
|----------|------|--------|
| `parseJSON` | 5.54 MB | urllib/utils.js:25 |
| `parseXml` | 3.50 MB | fast-xml-parser |
| `readTagExp` | 1.00 MB | fast-xml-parser |
| Other | 1.00 MB | - |

**Analysis**:
- `parseJSON` in urllib is the **#1 allocator** (10.24% of all allocations)
- XML parsing for binary sync (Puppeteer) also significant

**Call Stack for parseJSON**:
```
processTicksAndRejections
└── #requestInternal (HttpClient.js:126)
    └── parseJSON (utils.js:25)  [5.54 MB]
```

### 2. Tegg Runtime (16.64% = 9.00 MB)

| Function | Size | Source |
|----------|------|--------|
| `getOrCreateEggObject` | 3.50 MB | EggContainerFactory.js:28 |
| `initWithInjectProperty` | 2.00 MB | EggObjectImpl.js:20 |
| `objectPreDestroy` | 0.50 MB | LifycycleUtil.js:44 |
| Other | 3.00 MB | - |

**Analysis**:
- DI container creates objects per request
- Object initialization allocates significant memory
- Consider object pooling or singleton patterns

### 3. Leoric ORM (14.80% = 8.01 MB)

| Function | Size | Source |
|----------|------|--------|
| `parseExprList` | 2.00 MB | expr.js:137 |
| `instantiate` | 1.50 MB | bone.js:1282 |
| `dispatch` | 1.00 MB | collection.js:81 |
| `parseObject` | 1.00 MB | query_object.js:178 |
| `token` | 1.00 MB | expr.js:266 |
| `changes` | 0.50 MB | bone.js:440 |
| `then` | 0.50 MB | spell.js:458 |

**Analysis**:
- SQL expression parsing allocates heavily (`parseExprList`, `token`)
- Object instantiation (`instantiate`, `dispatch`)
- Query building creates many intermediate objects

**Call Stack for instantiate**:
```
processTicksAndRejections
└── ignite (spell.js:441)
    └── init (collection.js:13)
        └── dispatch (collection.js:81)
            └── instantiate (bone.js:1282)  [1.50 MB]
```

### 4. MySQL Driver (4.62% = 2.50 MB)

| Function | Size | Source |
|----------|------|--------|
| `keyFromFields` | 1.00 MB | parser_cache.js:9 |
| `get` | 1.00 MB | column_definition.js:263 |
| `assign` | 1.50 MB | (native, in query path) |

### 5. Buffer Operations (6.48% = 3.51 MB)

| Function | Size | Source |
|----------|------|--------|
| `slice` | 1.50 MB | node:buffer:646 |
| `toString` | 1.50 MB | (native) |
| `Uint8Array` | 1.50 MB | (native) |

---

## Correlation with CPU Profile

| Component | CPU % (High Load) | Memory Allocation % | Correlation |
|-----------|-------------------|---------------------|-------------|
| Leoric ORM | 16.69% | 14.80% | ✅ High CPU + High Memory |
| Tegg Runtime | 9.08% | 16.64% | ⚠️ Medium CPU, High Memory |
| JSON Parsing | 1.21% | 20.40% | ⚠️ Low CPU, **Very High Memory** |
| MySQL Driver | 9.01% | 4.62% | ✅ High CPU, Low Memory |

**Key Insight**: JSON parsing has **low CPU impact but high memory impact** - this is typical of I/O-bound operations that allocate large response buffers.

---

## Memory Optimization Recommendations

### Priority 1: JSON Parsing (Potential 5-10 MB savings)

1. **Stream JSON parsing** for large responses
   ```javascript
   // Instead of loading full response
   const data = await response.json();

   // Stream parse for large payloads
   import { parse } from 'stream-json';
   ```

2. **Cache parsed JSON** for repeated requests
   ```javascript
   const jsonCache = new LRU({ max: 100, maxAge: 60000 });
   ```

3. **Lazy parsing** - don't parse until needed

### Priority 2: Tegg DI Container (Potential 3-5 MB savings)

1. **Singleton services** where possible
   ```typescript
   @SingletonProto()
   export class MyService { }
   ```

2. **Object pooling** for frequently created objects

3. **Reduce per-request object creation**

### Priority 3: Leoric ORM (Potential 3-5 MB savings)

1. **Pre-compile queries** to avoid expression parsing
   ```javascript
   // Cache compiled queries
   const compiledQuery = Model.find().where({ status: 'active' }).compile();
   ```

2. **Raw queries** for simple operations
   ```javascript
   const rows = await Model.driver.query('SELECT id, name FROM table');
   ```

3. **Batch processing** to reduce object creation

### Priority 4: XML Parsing (Potential 3-5 MB savings)

1. **Streaming XML parser** for large responses
2. **Cache parsed binary manifests**
3. **Consider binary format** (MessagePack, protobuf)

---

## Memory Budget

Based on this profile, recommended allocation budget:

| Component | Current | Target | Action |
|-----------|---------|--------|--------|
| JSON Parsing | 20.40% | 10% | Cache + stream |
| Tegg Runtime | 16.64% | 10% | Singletons |
| Leoric ORM | 14.80% | 8% | Query caching |
| XML Parsing | 10.17% | 5% | Cache manifests |
| **Total Reduction** | - | ~24% | - |

---

## Action Items

| Priority | Action | Expected Impact | Effort |
|----------|--------|-----------------|--------|
| P0 | Cache HTTP response JSON | -5 MB | Low |
| P0 | Cache XML binary manifests | -3 MB | Low |
| P1 | Singleton Tegg services | -3 MB | Medium |
| P1 | Pre-compile Leoric queries | -2 MB | Medium |
| P2 | Stream large JSON responses | -2 MB | Medium |
| P2 | Object pooling | -2 MB | High |

---

## Summary

The heap allocation profile reveals:

1. **JSON parsing is the #1 allocator** (20.40%) despite low CPU usage
2. **Tegg DI container** allocates heavily per-request (16.64%)
3. **Leoric ORM** expression parsing is allocation-heavy (14.80%)
4. **XML parsing** for binary sync is significant (10.17%)

Combined with CPU profile data, the optimization priorities are:

1. **Leoric ORM** - High CPU + High Memory (optimize both)
2. **JSON/XML Parsing** - Low CPU but High Memory (add caching)
3. **Tegg Runtime** - Medium CPU + High Memory (use singletons)

---

*Analysis generated for heap allocation profiling*
