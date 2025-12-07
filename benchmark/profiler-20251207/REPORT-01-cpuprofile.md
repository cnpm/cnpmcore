# CPU Profile Analysis Report

Generated: 2025-12-07T13:22:08.158Z

## Summary

| Metric | Value |
|--------|-------|
| Profile File | 01-x-cpuprofile-3591251-20251207-0.cpuprofile |
| Total Nodes | 3489 |
| Total Hits | 168248 |
| Profile Type | xprofiler-cpu-profile |

## Module Breakdown

| Module | Hits | % | Functions |
|--------|------|---|----------|
| (native/gc) | 164606 | 97.84% | 56 |
| leoric@leoric | 1183 | 0.70% | 84 |
| node:internal | 445 | 0.26% | 187 |
| mysql2@mysql2 | 227 | 0.13% | 38 |
| cnpmcore (app) | 203 | 0.12% | 137 |
| @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs | 117 | 0.07% | 20 |
| urllib@urllib | 102 | 0.06% | 7 |
| node:buffer | 84 | 0.05% | 19 |
| @eggjs_koa@3.1.0-beta.34@@eggjs | 70 | 0.04% | 20 |
| @fengmk2_tar@@fengmk2 | 67 | 0.04% | 23 |
| @eggjs_lifecycle@4.0.0-beta.34@@eggjs | 66 | 0.04% | 10 |
| node:net | 64 | 0.04% | 29 |
| reflect-metadata@reflect-metadata | 53 | 0.03% | 10 |
| node:events | 52 | 0.03% | 11 |
| node:_http_server | 50 | 0.03% | 9 |
| node:_http_incoming | 49 | 0.03% | 5 |
| undici@undici | 46 | 0.03% | 28 |
| @eggjs_router@4.0.0-beta.34@@eggjs | 44 | 0.03% | 6 |
| deep-equal@deep-equal | 40 | 0.02% | 3 |
| is-string@is-string | 39 | 0.02% | 2 |

## cnpmcore Application Analysis

### Leoric (ORM)

- **Total Hits**: 1183 (0.70%)
- **Top Functions**:
  - `Bone` in /home/admin/application/node_modules/_leoric@2.13.9@leoric/lib/bone.js:150 (658 hits)
  - `instantiate` in /home/admin/application/node_modules/_leoric@2.13.9@leoric/lib/bone.js:1282 (86 hits)
  - `dispatch` in /home/admin/application/node_modules/_leoric@2.13.9@leoric/lib/collection.js:81 (71 hits)
  - `isLogicalCondition` in /home/admin/application/node_modules/_leoric@2.13.9@leoric/lib/query_object.js:102 (32 hits)
  - `token` in /home/admin/application/node_modules/_leoric@2.13.9@leoric/lib/expr.js:266 (29 hits)

### MySQL Driver

- **Total Hits**: 227 (0.13%)
- **Top Functions**:
  - `get` in /home/admin/application/node_modules/_mysql2@3.15.3@mysql2/lib/packets/column_definition.js:263 (47 hits)
  - `start` in /home/admin/application/node_modules/_mysql2@3.15.3@mysql2/lib/commands/query.js:48 (35 hits)
  - `keyFromFields` in /home/admin/application/node_modules/_mysql2@3.15.3@mysql2/lib/parsers/parser_cache.js:9 (20 hits)
  - `query` in /home/admin/application/node_modules/_mysql2@3.15.3@mysql2/lib/base/connection.js:560 (18 hits)
  - `parseDateTime` in /home/admin/application/node_modules/_mysql2@3.15.3@mysql2/lib/packets/packet.js:649 (18 hits)

### HTTP/Router

- **Total Hits**: 520 (0.31%)
- **Top Functions**:
  - `_respond` in file:///home/admin/application/node_modules/_@eggjs_koa@3.1.0-beta.34@@eggjs/koa/dist/application.js:218 (28 hits)
  - `(anonymous)` in file:///home/admin/application/node_modules/_@eggjs_controller-plugin@4.0.0-beta.34@@eggjs/controller-plugin/dist/lib/impl/http/HTTPMethodRegister.js:36 (19 hits)
  - `(anonymous)` in file:///home/admin/application/node_modules/_@eggjs_router@4.0.0-beta.34@@eggjs/router/dist/Router.js:137 (15 hits)
  - `match` in file:///home/admin/application/node_modules/_@eggjs_router@4.0.0-beta.34@@eggjs/router/dist/Layer.js:72 (15 hits)
  - `getLifecycleHook` in file:///home/admin/application/node_modules/_@eggjs_lifecycle@4.0.0-beta.34@@eggjs/lifecycle/dist/LifycycleUtil.js:72 (15 hits)

### JSON Processing

- **Total Hits**: 155 (0.09%)
- **Top Functions**:
  - `parseJSON` in file:///home/admin/application/node_modules/_urllib@4.8.2@urllib/dist/esm/utils.js:25 (80 hits)
  - `parseChannelMessages` in node:internal/child_process/serialization:142 (22 hits)
  - `parserOnIncoming` in node:_http_server:1073 (10 hits)
  - `parseHeaders` in /home/admin/application/node_modules/_undici@7.16.0@undici/lib/core/util.js:420 (8 hits)
  - `parserOnHeadersComplete` in node:_http_common:75 (8 hits)

### Compression

- **Total Hits**: 4 (0.00%)
- **Top Functions**:
  - `syncBufferWrapper` in node:zlib:788 (1 hits)
  - `zlibBufferSync` in node:zlib:165 (1 hits)
  - `processChunkSync` in node:zlib:400 (1 hits)
  - `Zlib` in node:zlib:620 (1 hits)

### Validation

- **Total Hits**: 2 (0.00%)
- **Top Functions**:
  - `(anonymous)` in node:internal/validators:460 (1 hits)
  - `(anonymous)` in node:internal/validators:139 (1 hits)

### Entity/Service

- **Total Hits**: 94 (0.06%)
- **Top Functions**:
  - `syncPackageWithPackument` in file:///home/admin/application/app/core/service/PackageSyncerService.js:926 (50 hits)
  - `syncPackage` in file:///home/admin/application/app/core/service/PackageSearchService.js:16 (18 hits)
  - `listRootBinaries` in file:///home/admin/application/app/core/service/BinarySyncerService.js:36 (2 hits)
  - `isoNow` in file:///home/admin/application/app/core/service/BinarySyncerService.js:23 (2 hits)
  - `appendTaskLog` in file:///home/admin/application/app/core/service/TaskService.js:140 (2 hits)

### Controller

- **Total Hits**: 12 (0.01%)
- **Top Functions**:
  - `showBinary` in file:///home/admin/application/app/port/controller/BinarySyncController.js:38 (6 hits)
  - `formatItems` in file:///home/admin/application/app/port/controller/BinarySyncController.js:134 (3 hits)
  - `miscGet` in file:///home/admin/application/app/port/controller/HomeController.js:58 (2 hits)
  - `show` in file:///home/admin/application/app/port/controller/package/ShowPackageController.js:21 (1 hits)

### Other App Code

- **Total Hits**: 653 (0.39%)
- **Top Functions**:
  - `tryStringObject` in /home/admin/application/node_modules/_is-string@1.1.1@is-string/index.js:9 (39 hits)
  - `objEquiv` in /home/admin/application/node_modules/_deep-equal@2.2.3@deep-equal/index.js:276 (39 hits)
  - `__classPrivateFieldGet` in /home/admin/application/node_modules/_tslib@2.8.1@tslib/tslib.js:336 (28 hits)
  - `convertModelToEntity` in file:///home/admin/application/app/repository/util/ModelConvertor.js:74 (21 hits)
  - `isMap` in /home/admin/application/node_modules/_is-map@2.0.3@is-map/index.js:30 (21 hits)

## Top 30 Functions by Self Time

| # | Function | Location | Hits | % |
|---|----------|----------|------|---|
| 1 | (idle) | (native):0 | 162444 | 96.55% |
| 2 | Bone | bone.js:150 | 658 | 0.39% |
| 3 | (garbage collector) | (native):0 | 481 | 0.29% |
| 4 | (program) | (native):0 | 420 | 0.25% |
| 5 | custom_gc | (native):0 | 350 | 0.21% |
| 6 | writeSync | (native):0 | 132 | 0.08% |
| 7 | runMicrotasks | (native):0 | 108 | 0.06% |
| 8 | (anonymous) | (native):0 | 92 | 0.05% |
| 9 | structuredClone | (native):0 | 91 | 0.05% |
| 10 | writev | (native):0 | 86 | 0.05% |
| 11 | instantiate | bone.js:1282 | 86 | 0.05% |
| 12 | parseJSON | utils.js:25 | 80 | 0.05% |
| 13 | dispatch | collection.js:81 | 71 | 0.04% |
| 14 | writeBuffer | (native):0 | 64 | 0.04% |
| 15 | update | (native):0 | 53 | 0.03% |
| 16 | syncPackageWithPackument | PackageSyncerService.js:926 | 50 | 0.03% |
| 17 | structuredClone | js_transferable:112 | 49 | 0.03% |
| 18 | toString | node:buffer:845 | 48 | 0.03% |
| 19 | writeUtf8String | (native):0 | 47 | 0.03% |
| 20 | get | column_definition.js:263 | 47 | 0.03% |
| 21 | tryStringObject | index.js:9 | 39 | 0.02% |
| 22 | objEquiv | index.js:276 | 39 | 0.02% |
| 23 | start | query.js:48 | 35 | 0.02% |
| 24 | isLogicalCondition | query_object.js:102 | 32 | 0.02% |
| 25 | _addHeaderLine | node:_http_incoming:382 | 32 | 0.02% |
| 26 | token | expr.js:266 | 29 | 0.02% |
| 27 | _respond | application.js:218 | 28 | 0.02% |
| 28 | __classPrivateFieldGet | tslib.js:336 | 28 | 0.02% |
| 29 | FastBuffer | buffer:963 | 27 | 0.02% |
| 30 | query | index.js:70 | 25 | 0.01% |

## Hot Paths (Top CPU Consuming Call Stacks)

### Path 1 (162444 hits)

```
  (idle) ((native):0)
```

### Path 2 (595 hits)

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

### Path 3 (481 hits)

```
  (garbage collector) ((native):0)
```

### Path 4 (420 hits)

```
  (program) ((native):0)
```

### Path 5 (148 hits)

```
  processTicksAndRejections (task_queues:71)
  runMicrotasks ((native):0)
  syncPackageWithPackument (PackageSyncerService.js:926)
  getBufferIn (package.js:17)
  custom_gc ((native):0)
```

### Path 6 (112 hits)

```
  processTicksAndRejections (task_queues:71)
  runMicrotasks ((native):0)
  #requestInternal (HttpClient.js:126)
  syncBufferWrapper (node:zlib:788)
  zlibBufferSync (node:zlib:165)
  processChunkSync (node:zlib:400)
  writeSync ((native):0)
```

### Path 7 (108 hits)

```
  processTicksAndRejections (task_queues:71)
  runMicrotasks ((native):0)
```


