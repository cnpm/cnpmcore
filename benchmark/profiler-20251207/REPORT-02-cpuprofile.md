# CPU Profile Analysis Report

Generated: 2025-12-07T13:22:08.082Z

## Summary

| Metric | Value |
|--------|-------|
| Profile File | 02-x-cpuprofile-3070674-20251207-0.cpuprofile |
| Total Nodes | 2401 |
| Total Hits | 168658 |
| Profile Type | xprofiler-cpu-profile |

## Module Breakdown

| Module | Hits | % | Functions |
|--------|------|---|----------|
| (native/gc) | 166106 | 98.49% | 43 |
| leoric@leoric | 747 | 0.44% | 77 |
| node:internal | 372 | 0.22% | 160 |
| mysql2@mysql2 | 187 | 0.11% | 36 |
| urllib@urllib | 137 | 0.08% | 7 |
| @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs | 101 | 0.06% | 17 |
| cnpmcore (app) | 75 | 0.04% | 114 |
| @eggjs_koa@3.1.0-beta.34@@eggjs | 66 | 0.04% | 17 |
| node:net | 63 | 0.04% | 25 |
| node:buffer | 51 | 0.03% | 17 |
| @eggjs_lifecycle@4.0.0-beta.34@@eggjs | 50 | 0.03% | 12 |
| @eggjs_router@4.0.0-beta.34@@eggjs | 46 | 0.03% | 6 |
| reflect-metadata@reflect-metadata | 40 | 0.02% | 10 |
| node:_http_server | 37 | 0.02% | 13 |
| node:_http_incoming | 37 | 0.02% | 7 |
| node:events | 36 | 0.02% | 10 |
| egg-logger@egg-logger | 32 | 0.02% | 8 |
| egg@4.1.0-beta.34@egg | 28 | 0.02% | 18 |
| @eggjs_controller-plugin@4.0.0-beta.34@@eggjs | 27 | 0.02% | 3 |
| lodash-es@lodash-es | 21 | 0.01% | 6 |

## cnpmcore Application Analysis

### Leoric (ORM)

- **Total Hits**: 747 (0.44%)
- **Top Functions**:
  - `Bone` in /home/admin/application/node_modules/_leoric@2.13.9@leoric/lib/bone.js:150 (407 hits)
  - `dispatch` in /home/admin/application/node_modules/_leoric@2.13.9@leoric/lib/collection.js:81 (47 hits)
  - `instantiate` in /home/admin/application/node_modules/_leoric@2.13.9@leoric/lib/bone.js:1282 (36 hits)
  - `isLogicalCondition` in /home/admin/application/node_modules/_leoric@2.13.9@leoric/lib/query_object.js:102 (25 hits)
  - `Spell` in /home/admin/application/node_modules/_leoric@2.13.9@leoric/lib/spell.js:325 (16 hits)

### MySQL Driver

- **Total Hits**: 187 (0.11%)
- **Top Functions**:
  - `get` in /home/admin/application/node_modules/_mysql2@3.15.3@mysql2/lib/packets/column_definition.js:263 (36 hits)
  - `start` in /home/admin/application/node_modules/_mysql2@3.15.3@mysql2/lib/commands/query.js:48 (31 hits)
  - `keyFromFields` in /home/admin/application/node_modules/_mysql2@3.15.3@mysql2/lib/parsers/parser_cache.js:9 (20 hits)
  - `createQuery` in /home/admin/application/node_modules/_mysql2@3.15.3@mysql2/lib/base/connection.js:911 (10 hits)
  - `handlePacket` in /home/admin/application/node_modules/_mysql2@3.15.3@mysql2/lib/base/connection.js:419 (8 hits)

### HTTP/Router

- **Total Hits**: 469 (0.28%)
- **Top Functions**:
  - `_respond` in file:///home/admin/application/node_modules/_@eggjs_koa@3.1.0-beta.34@@eggjs/koa/dist/application.js:218 (21 hits)
  - `match` in file:///home/admin/application/node_modules/_@eggjs_router@4.0.0-beta.34@@eggjs/router/dist/Layer.js:72 (19 hits)
  - `dispatch` in /home/admin/application/node_modules/_koa-compose@4.1.0@koa-compose/index.js:35 (18 hits)
  - `(anonymous)` in file:///home/admin/application/node_modules/_@eggjs_router@4.0.0-beta.34@@eggjs/router/dist/Router.js:137 (17 hits)
  - `injectProperty` in file:///home/admin/application/node_modules/_@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/impl/EggObjectImpl.js:165 (16 hits)

### JSON Processing

- **Total Hits**: 160 (0.09%)
- **Top Functions**:
  - `parseJSON` in file:///home/admin/application/node_modules/_urllib@4.8.2@urllib/dist/esm/utils.js:25 (117 hits)
  - `parseChannelMessages` in node:internal/child_process/serialization:142 (20 hits)
  - `parserOnIncoming` in node:_http_server:1073 (8 hits)
  - `parse` in (native):0 (2 hits)
  - `readDistBytesToJSON` in file:///home/admin/application/app/repository/DistRepository.js:56 (2 hits)

### Compression

- **Total Hits**: 5 (0.00%)
- **Top Functions**:
  - `processChunkSync` in node:zlib:400 (4 hits)
  - `ZlibBase` in node:zlib:210 (1 hits)

### Validation

- **Total Hits**: 6 (0.00%)
- **Top Functions**:
  - `(anonymous)` in node:internal/validators:536 (2 hits)
  - `validate` in file:///home/admin/application/app/port/typebox.js:138 (2 hits)
  - `(anonymous)` in node:internal/validators:95 (1 hits)
  - `validate` in /home/admin/application/node_modules/_validate-npm-package-name@7.0.0@validate-npm-package-name/lib/index.js:10 (1 hits)

### Entity/Service

- **Total Hits**: 19 (0.01%)
- **Top Functions**:
  - `findBinary` in file:///home/admin/application/app/core/service/BinarySyncerService.js:30 (4 hits)
  - `findExecuteTask` in file:///home/admin/application/app/core/service/PackageSyncerService.js:48 (2 hits)
  - `syncDir` in file:///home/admin/application/app/core/service/BinarySyncerService.js:137 (2 hits)
  - `listRootBinaries` in file:///home/admin/application/app/core/service/BinarySyncerService.js:36 (2 hits)
  - `misc` in file:///home/admin/application/app/core/service/HomeService.js:12 (1 hits)

### Controller

- **Total Hits**: 10 (0.01%)
- **Top Functions**:
  - `showBinary` in file:///home/admin/application/app/port/controller/BinarySyncController.js:38 (7 hits)
  - `createSyncTask` in file:///home/admin/application/app/port/controller/PackageSyncController.js:37 (1 hits)
  - `formatItems` in file:///home/admin/application/app/port/controller/BinarySyncController.js:134 (1 hits)
  - `(anonymous)` in file:///home/admin/application/app/port/controller/BinarySyncController.js:135 (1 hits)

### Other App Code

- **Total Hits**: 343 (0.20%)
- **Top Functions**:
  - `getProvider` in /home/admin/application/node_modules/_reflect-metadata@0.2.2@reflect-metadata/Reflect.js:946 (18 hits)
  - `convertModelToEntity` in file:///home/admin/application/app/repository/util/ModelConvertor.js:74 (17 hits)
  - `__classPrivateFieldGet` in /home/admin/application/node_modules/_tslib@2.8.1@tslib/tslib.js:336 (17 hits)
  - `tryStringObject` in /home/admin/application/node_modules/_is-string@1.1.1@is-string/index.js:9 (16 hits)
  - `OrdinaryGetMetadata` in /home/admin/application/node_modules/_reflect-metadata@0.2.2@reflect-metadata/Reflect.js:591 (13 hits)

## Top 30 Functions by Self Time

| # | Function | Location | Hits | % |
|---|----------|----------|------|---|
| 1 | (idle) | (native):0 | 164808 | 97.72% |
| 2 | (program) | (native):0 | 444 | 0.26% |
| 3 | Bone | bone.js:150 | 407 | 0.24% |
| 4 | (garbage collector) | (native):0 | 345 | 0.20% |
| 5 | parseJSON | utils.js:25 | 117 | 0.07% |
| 6 | writeSync | (native):0 | 72 | 0.04% |
| 7 | (anonymous) | (native):0 | 66 | 0.04% |
| 8 | runMicrotasks | (native):0 | 62 | 0.04% |
| 9 | structuredClone | (native):0 | 53 | 0.03% |
| 10 | writev | (native):0 | 52 | 0.03% |
| 11 | nextTick | task_queues:111 | 47 | 0.03% |
| 12 | dispatch | collection.js:81 | 47 | 0.03% |
| 13 | writeBuffer | (native):0 | 41 | 0.02% |
| 14 | toString | node:buffer:845 | 38 | 0.02% |
| 15 | instantiate | bone.js:1282 | 36 | 0.02% |
| 16 | get | column_definition.js:263 | 36 | 0.02% |
| 17 | writeUtf8String | (native):0 | 34 | 0.02% |
| 18 | start | query.js:48 | 31 | 0.02% |
| 19 | _addHeaderLine | node:_http_incoming:382 | 31 | 0.02% |
| 20 | isLogicalCondition | query_object.js:102 | 25 | 0.01% |
| 21 | structuredClone | js_transferable:112 | 24 | 0.01% |
| 22 | _respond | application.js:218 | 21 | 0.01% |
| 23 | getPeerCertificate | (native):0 | 21 | 0.01% |
| 24 | parseChannelMessages | serialization:142 | 20 | 0.01% |
| 25 | keyFromFields | parser_cache.js:9 | 20 | 0.01% |
| 26 | processTicksAndRejections | task_queues:71 | 19 | 0.01% |
| 27 | match | Layer.js:72 | 19 | 0.01% |
| 28 | dispatch | index.js:35 | 18 | 0.01% |
| 29 | getProvider | Reflect.js:946 | 18 | 0.01% |
| 30 | emit | node:events:455 | 17 | 0.01% |

## Hot Paths (Top CPU Consuming Call Stacks)

### Path 1 (164808 hits)

```
  (idle) ((native):0)
```

### Path 2 (444 hits)

```
  (program) ((native):0)
```

### Path 3 (380 hits)

```
  processTicksAndRejections (task_queues:71)
  runMicrotasks ((native):0)
  ignite (spell.js:441)
  init (collection.js:13)
  dispatch (collection.js:81)
  instantiate (bone.js:1282)
  ContextModelClass (SingletonModelObject.js:17)
  Bone (bone.js:150)
```

### Path 4 (345 hits)

```
  (garbage collector) ((native):0)
```

### Path 5 (117 hits)

```
  processTicksAndRejections (task_queues:71)
  runMicrotasks ((native):0)
  #requestInternal (HttpClient.js:126)
  parseJSON (utils.js:25)
```


