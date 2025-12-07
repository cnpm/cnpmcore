# Heap Allocation Profile Analysis

Generated: 2025-12-07T13:39:12.929Z

## Summary

| Metric | Value |
|--------|-------|
| File | x-heapprofile-3070674-20251207-1.heapprofile |
| Total Allocations | 71 |
| Total Size | 54.10 MB |

## Allocations by Module

| Module | Size (MB) | % | Count |
|--------|-----------|---|-------|
| . | 15.53 | 28.70% | 26 |
| leoric@leoric | 8.01 | 14.80% | 12 |
| @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs | 6.50 | 12.02% | 6 |
| urllib@urllib | 6.04 | 11.16% | 2 |
| fast-xml-parser@fast-xml-parser | 5.50 | 10.17% | 4 |
| mysql2@mysql2 | 2.50 | 4.62% | 3 |
| node:internal | 2.02 | 3.73% | 3 |
| node:buffer | 2.01 | 3.71% | 3 |
| @eggjs_lifecycle@4.0.0-beta.34@@eggjs | 1.00 | 1.85% | 2 |
| cnpmcore (app) | 1.00 | 1.85% | 2 |
| deep-equal@deep-equal | 0.50 | 0.92% | 1 |
| node:_http_incoming | 0.50 | 0.92% | 1 |
| strnum@strnum | 0.50 | 0.92% | 1 |
| node:_tls_wrap | 0.50 | 0.92% | 1 |
| @eggjs_tracer@4.0.0-beta.34@@eggjs | 0.50 | 0.92% | 1 |
| for-each@for-each | 0.50 | 0.92% | 1 |
| @eggjs_controller-plugin@4.0.0-beta.34@@eggjs | 0.50 | 0.92% | 1 |
| koa-compose@koa-compose | 0.50 | 0.92% | 1 |

## cnpmcore-Specific Allocations

| Category | Size (MB) | % | Count | Top Functions |
|----------|-----------|---|-------|---------------|
| JSON | 11.04 | 20.40% | 5 | parseJSON, parseXml, readTagExp |
| HTTP/Koa | 9.00 | 16.64% | 11 | getOrCreateEggObject, initWithInjectProperty, objectPreDestroy |
| Leoric (ORM) | 8.01 | 14.80% | 12 | instantiate, dispatch, parseExprList |
| Buffer/Binary | 3.51 | 6.48% | 6 | slice, toString, Uint8Array |
| App Code | 3.00 | 5.55% | 6 | #requestInternal, objEquiv, toNumber |
| MySQL Driver | 2.50 | 4.62% | 3 | keyFromFields, get, executeStart |
| String Operations | 1.50 | 2.77% | 3 | toString |

## Top 30 Allocating Functions

| # | Function | Location | Size (MB) | % |
|---|----------|----------|-----------|---|
| 1 | parseJSON | utils.js:25 | 5.54 | 10.24% |
| 2 | getOrCreateEggObject | EggContainerFactory.js:28 | 3.50 | 6.47% |
| 3 | parseXml | OrderedObjParser.js:200 | 3.50 | 6.47% |
| 4 | keys | (native):0 | 2.50 | 4.62% |
| 5 | parseExprList | expr.js:137 | 2.00 | 3.70% |
| 6 | initWithInjectProperty | EggObjectImpl.js:20 | 2.00 | 3.70% |
| 7 | assign | (native):0 | 1.50 | 2.78% |
| 8 | instantiate | bone.js:1282 | 1.50 | 2.77% |
| 9 | Uint8Array | (native):0 | 1.50 | 2.77% |
| 10 | slice | node:buffer:646 | 1.50 | 2.77% |
| 11 | toString | (native):0 | 1.50 | 2.77% |
| 12 | (anonymous) | undici:2058 | 1.02 | 1.88% |
| 13 | dispatch | collection.js:81 | 1.00 | 1.85% |
| 14 | parseObject | query_object.js:178 | 1.00 | 1.85% |
| 15 | add | (native):0 | 1.00 | 1.85% |
| 16 | push | (native):0 | 1.00 | 1.85% |
| 17 | keyFromFields | parser_cache.js:9 | 1.00 | 1.85% |
| 18 | all | (native):0 | 1.00 | 1.85% |
| 19 | (V8 API) | (native):0 | 1.00 | 1.85% |
| 20 | has | (native):0 | 1.00 | 1.85% |
| 21 | readTagExp | OrderedObjParser.js:524 | 1.00 | 1.85% |
| 22 | get | column_definition.js:263 | 1.00 | 1.85% |
| 23 | token | expr.js:266 | 1.00 | 1.85% |
| 24 | set | (native):0 | 0.52 | 0.96% |
| 25 | toString | node:buffer:845 | 0.51 | 0.93% |
| 26 | #requestInternal | HttpClient.js:132 | 0.50 | 0.93% |
| 27 | changes | bone.js:440 | 0.50 | 0.92% |
| 28 | then | spell.js:458 | 0.50 | 0.92% |
| 29 | objectPreDestroy | LifycycleUtil.js:44 | 0.50 | 0.92% |
| 30 | exec | (native):0 | 0.50 | 0.92% |

## Top Allocation Call Stacks

### Stack 1 (5.54 MB, 10.24%)

```
  (root) ((native):0)
  processTicksAndRejections (task_queues:71)
  (anonymous) ((native):0)
  #requestInternal (HttpClient.js:126)
  parseJSON (utils.js:25)
```

### Stack 2 (3.50 MB, 6.47%)

```
  (root) ((native):0)
  processTicksAndRejections (task_queues:71)
  (anonymous) ((native):0)
  fetch (PuppeteerBinary.js:17)
  parse (XMLParser.js:19)
  parseXml (OrderedObjParser.js:200)
```

### Stack 3 (2.50 MB, 4.62%)

```
  (root) ((native):0)
  processTicksAndRejections (task_queues:71)
  (anonymous) ((native):0)
  getOrCreateEggObject (EggContainerFactory.js:28)
```

### Stack 4 (2.00 MB, 3.70%)

```
  (root) ((native):0)
  processTicksAndRejections (task_queues:71)
  (anonymous) ((native):0)
  initWithInjectProperty (EggObjectImpl.js:20)
```

### Stack 5 (1.50 MB, 2.78%)

```
  (root) ((native):0)
  processTicksAndRejections (task_queues:71)
  (anonymous) ((native):0)
  query (index.js:70)
  query (connection.js:560)
  handlePacket (connection.js:419)
  start (query.js:48)
  assign ((native):0)
```

### Stack 6 (1.50 MB, 2.77%)

```
  (root) ((native):0)
  processTicksAndRejections (task_queues:71)
  (anonymous) ((native):0)
  ignite (spell.js:441)
  init (collection.js:13)
  dispatch (collection.js:81)
  instantiate (bone.js:1282)
```

### Stack 7 (1.02 MB, 1.88%)

```
  Agent (undici:8923)
  defaultFactory (undici:8877)
  Pool (undici:8784)
  PoolBase (undici:2143)
  (anonymous) (undici:2147)
  FixedQueue (undici:2096)
  FixedCircularBuffer (undici:2053)
  (anonymous) (undici:2058)
```

### Stack 8 (1.00 MB, 1.85%)

```
  (root) ((native):0)
  processTicksAndRejections (task_queues:71)
  (anonymous) ((native):0)
  ignite (spell.js:441)
  init (collection.js:13)
  dispatch (collection.js:81)
```

### Stack 9 (1.00 MB, 1.85%)

```
  saveTask (TaskRepository.js:18)
  saveEntityToModel (ModelConvertor.js:50)
  _save (bone.js:553)
  _update (bone.js:742)
  $where (spell.js:589)
  parseConditions (spell.js:45)
  parseObject (query_object.js:178)
  parseExprList (expr.js:137)
```

### Stack 10 (1.00 MB, 1.85%)

```
  addChunk (readable:548)
  emit (node:events:455)
  (anonymous) (connection.js:95)
  executeStart (packet_parser.js:63)
  handlePacket (connection.js:419)
  readField (query.js:191)
  getTextParser (text_parser.js:210)
  keyFromFields (parser_cache.js:9)
```


