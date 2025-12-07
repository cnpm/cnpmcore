# CPU Profile Analysis Report

Generated: 2025-12-07T13:25:54.492Z

## Summary

| Metric | Value |
|--------|-------|
| Profile File | registry.npmmirror.com-07-x-cpuprofile-2308828-20251207-0.cpuprofile |
| Total Nodes | 5760 |
| Total Hits | 166949 |
| Profile Type | xprofiler-cpu-profile |

## Module Breakdown

| Module | Hits | % | Functions |
|--------|------|---|----------|
| (native/gc) | 150218 | 89.98% | 54 |
| leoric@leoric | 4303 | 2.58% | 89 |
| node:internal | 2971 | 1.78% | 234 |
| cnpmcore (app) | 1043 | 0.62% | 173 |
| mysql2@mysql2 | 1027 | 0.62% | 47 |
| @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs | 818 | 0.49% | 22 |
| @eggjs_koa@3.1.0-beta.34@@eggjs | 756 | 0.45% | 24 |
| reflect-metadata@reflect-metadata | 524 | 0.31% | 10 |
| @eggjs_router@4.0.0-beta.34@@eggjs | 430 | 0.26% | 6 |
| node:net | 356 | 0.21% | 32 |
| @eggjs_lifecycle@4.0.0-beta.34@@eggjs | 341 | 0.20% | 12 |
| egg-logger@egg-logger | 326 | 0.20% | 10 |
| node:_http_incoming | 262 | 0.16% | 8 |
| node:_http_server | 216 | 0.13% | 18 |
| @eggjs_controller-plugin@4.0.0-beta.34@@eggjs | 207 | 0.12% | 3 |
| node:buffer | 206 | 0.12% | 20 |
| @eggjs_tegg-plugin@4.0.0-beta.34@@eggjs | 185 | 0.11% | 14 |
| node:events | 181 | 0.11% | 13 |
| @eggjs_aop-runtime@4.0.0-beta.34@@eggjs | 179 | 0.11% | 10 |
| egg@4.1.0-beta.34@egg | 173 | 0.10% | 25 |

## cnpmcore Application Analysis

### Leoric (ORM)

- **Total Hits**: 4303 (2.58%)
- **Top Functions**:
  - `Bone` in /home/admin/application/node_modules/_leoric@2.13.9@leoric/lib/bone.js:150 (1995 hits)
  - `dispatch` in /home/admin/application/node_modules/_leoric@2.13.9@leoric/lib/collection.js:81 (409 hits)
  - `instantiate` in /home/admin/application/node_modules/_leoric@2.13.9@leoric/lib/bone.js:1282 (234 hits)
  - `isLogicalCondition` in /home/admin/application/node_modules/_leoric@2.13.9@leoric/lib/query_object.js:102 (139 hits)
  - `token` in /home/admin/application/node_modules/_leoric@2.13.9@leoric/lib/expr.js:266 (113 hits)

### MySQL Driver

- **Total Hits**: 1027 (0.62%)
- **Top Functions**:
  - `get` in /home/admin/application/node_modules/_mysql2@3.15.3@mysql2/lib/packets/column_definition.js:263 (194 hits)
  - `parseDateTime` in /home/admin/application/node_modules/_mysql2@3.15.3@mysql2/lib/packets/packet.js:649 (157 hits)
  - `start` in /home/admin/application/node_modules/_mysql2@3.15.3@mysql2/lib/commands/query.js:48 (130 hits)
  - `keyFromFields` in /home/admin/application/node_modules/_mysql2@3.15.3@mysql2/lib/parsers/parser_cache.js:9 (106 hits)
  - `exports.decode` in /home/admin/application/node_modules/_mysql2@3.15.3@mysql2/lib/parsers/string.js:10 (64 hits)

### HTTP/Router

- **Total Hits**: 3920 (2.35%)
- **Top Functions**:
  - `_respond` in file:///home/admin/application/node_modules/_@eggjs_koa@3.1.0-beta.34@@eggjs/koa/dist/application.js:218 (443 hits)
  - `match` in file:///home/admin/application/node_modules/_@eggjs_router@4.0.0-beta.34@@eggjs/router/dist/Layer.js:72 (184 hits)
  - `getOrCreateEggObject` in file:///home/admin/application/node_modules/_@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/factory/EggContainerFactory.js:28 (130 hits)
  - `(anonymous)` in file:///home/admin/application/node_modules/_@eggjs_router@4.0.0-beta.34@@eggjs/router/dist/Router.js:137 (128 hits)
  - `dispatch` in /home/admin/application/node_modules/_koa-compose@4.1.0@koa-compose/index.js:35 (120 hits)

### JSON Processing

- **Total Hits**: 521 (0.31%)
- **Top Functions**:
  - `readDistBytesToJSON` in file:///home/admin/application/app/repository/DistRepository.js:31 (200 hits)
  - `parseChannelMessages` in node:internal/child_process/serialization:142 (93 hits)
  - `parse` in (native):0 (52 hits)
  - `parserOnHeadersComplete` in node:_http_common:74 (31 hits)
  - `parserOnIncoming` in node:_http_server:1073 (31 hits)

### Compression

- **Total Hits**: 4 (0.00%)
- **Top Functions**:
  - `processChunkSync` in node:zlib:407 (3 hits)
  - `zlibBufferSync` in node:zlib:165 (1 hits)

### Validation

- **Total Hits**: 29 (0.02%)
- **Top Functions**:
  - `(anonymous)` in node:internal/validators:536 (10 hits)
  - `validate` in /home/admin/application/node_modules/_validate-npm-package-name@7.0.0@validate-npm-package-name/lib/index.js:10 (5 hits)
  - `done` in /home/admin/application/node_modules/_validate-npm-package-name@7.0.0@validate-npm-package-name/lib/index.js:94 (5 hits)
  - `validRange` in /home/admin/application/node_modules/_semver@7.7.3@semver/ranges/valid.js:4 (4 hits)
  - `trim` in /home/admin/application/node_modules/_ajv-keywords@5.1.0@ajv-keywords/dist/definitions/transform.js:9 (1 hits)

### Entity/Service

- **Total Hits**: 259 (0.16%)
- **Top Functions**:
  - `_listPackageFullOrAbbreviatedManifests` in file:///home/admin/application/app/core/service/PackageManagerService.js:806 (60 hits)
  - `_updatePackageManifestsToDists` in file:///home/admin/application/app/core/service/PackageManagerService.js:764 (51 hits)
  - `syncPackage` in file:///home/admin/application/app/core/service/PackageSearchService.js:16 (36 hits)
  - `plusPackageVersionCounter` in file:///home/admin/application/app/core/service/PackageManagerService.js:407 (33 hits)
  - `Entity` in file:///home/admin/application/app/core/entity/Entity.js:2 (17 hits)

### Controller

- **Total Hits**: 151 (0.09%)
- **Top Functions**:
  - `show` in file:///home/admin/application/app/port/controller/package/ShowPackageController.js:20 (50 hits)
  - `showPackageDownloads` in file:///home/admin/application/app/port/controller/DownloadController.js:20 (28 hits)
  - `download` in file:///home/admin/application/app/port/controller/package/DownloadPackageVersionTar.js:26 (24 hits)
  - `formatItems` in file:///home/admin/application/app/port/controller/BinarySyncController.js:134 (18 hits)
  - `(anonymous)` in file:///home/admin/application/app/port/controller/BinarySyncController.js:135 (14 hits)

### Other App Code

- **Total Hits**: 2275 (1.36%)
- **Top Functions**:
  - `convertModelToEntity` in file:///home/admin/application/app/repository/util/ModelConvertor.js:74 (183 hits)
  - `__classPrivateFieldGet` in /home/admin/application/node_modules/_tslib@2.8.1@tslib/tslib.js:336 (159 hits)
  - `OrdinaryGetMetadata` in /home/admin/application/node_modules/_reflect-metadata@0.2.2@reflect-metadata/Reflect.js:591 (146 hits)
  - `getProvider` in /home/admin/application/node_modules/_reflect-metadata@0.2.2@reflect-metadata/Reflect.js:946 (102 hits)
  - `OrdinaryGetPrototypeOf` in /home/admin/application/node_modules/_reflect-metadata@0.2.2@reflect-metadata/Reflect.js:844 (90 hits)

## Top 30 Functions by Self Time

| # | Function | Location | Hits | % |
|---|----------|----------|------|---|
| 1 | (idle) | (native):0 | 145114 | 86.92% |
| 2 | Bone | bone.js:150 | 1995 | 1.19% |
| 3 | (garbage collector) | (native):0 | 1404 | 0.84% |
| 4 | (program) | (native):0 | 986 | 0.59% |
| 5 | structuredClone | (native):0 | 695 | 0.42% |
| 6 | runMicrotasks | (native):0 | 530 | 0.32% |
| 7 | _respond | application.js:218 | 443 | 0.27% |
| 8 | dispatch | collection.js:81 | 409 | 0.24% |
| 9 | structuredClone | js_transferable:112 | 385 | 0.23% |
| 10 | nextTick | task_queues:113 | 350 | 0.21% |
| 11 | promiseInitHook | async_hooks:328 | 279 | 0.17% |
| 12 | writev | (native):0 | 242 | 0.14% |
| 13 | instantiate | bone.js:1282 | 234 | 0.14% |
| 14 | readDistBytesToJSON | DistRepository.js:31 | 200 | 0.12% |
| 15 | _addHeaderLine | node:_http_incoming:382 | 194 | 0.12% |
| 16 | get | column_definition.js:263 | 194 | 0.12% |
| 17 | match | Layer.js:72 | 184 | 0.11% |
| 18 | convertModelToEntity | ModelConvertor.js:74 | 183 | 0.11% |
| 19 | lookupPublicResource | async_hooks:177 | 165 | 0.10% |
| 20 | __classPrivateFieldGet | tslib.js:336 | 159 | 0.10% |
| 21 | parseDateTime | packet.js:649 | 157 | 0.09% |
| 22 | writeBuffer | (native):0 | 148 | 0.09% |
| 23 | OrdinaryGetMetadata | Reflect.js:591 | 146 | 0.09% |
| 24 | isLogicalCondition | query_object.js:102 | 139 | 0.08% |
| 25 | writeUtf8String | (native):0 | 137 | 0.08% |
| 26 | getOrCreateEggObject | EggContainerFactory.js:28 | 130 | 0.08% |
| 27 | start | query.js:48 | 130 | 0.08% |
| 28 | (anonymous) | Router.js:137 | 128 | 0.08% |
| 29 | slice | node:buffer:636 | 125 | 0.07% |
| 30 | utf8Slice | (native):0 | 125 | 0.07% |

## Hot Paths (Top CPU Consuming Call Stacks)

### Path 1 (145114 hits)

```
  (idle) ((native):0)
```

### Path 2 (1981 hits)

```
  processTicksAndRejections (task_queues:72)
  runMicrotasks ((native):0)
  ignite (spell.js:441)
  init (collection.js:13)
  dispatch (collection.js:81)
  instantiate (bone.js:1282)
  ContextModelClass (SingletonModelObject.js:17)
  Bone (bone.js:150)
```

### Path 3 (1404 hits)

```
  (garbage collector) ((native):0)
```

### Path 4 (986 hits)

```
  (program) ((native):0)
```

### Path 5 (691 hits)

```
  processTicksAndRejections (task_queues:72)
  runMicrotasks ((native):0)
  ignite (spell.js:441)
  init (collection.js:13)
  dispatch (collection.js:81)
  instantiate (bone.js:1282)
  cloneValue (bone.js:112)
  structuredClone (js_transferable:112)
  structuredClone ((native):0)
```

### Path 6 (526 hits)

```
  processTicksAndRejections (task_queues:72)
  runMicrotasks ((native):0)
```

### Path 7 (440 hits)

```
  processTicksAndRejections (task_queues:72)
  runMicrotasks ((native):0)
  handleRequest (application.js:168)
  _respond (application.js:218)
```

### Path 8 (409 hits)

```
  processTicksAndRejections (task_queues:72)
  runMicrotasks ((native):0)
  ignite (spell.js:441)
  init (collection.js:13)
  dispatch (collection.js:81)
```

### Path 9 (382 hits)

```
  processTicksAndRejections (task_queues:72)
  runMicrotasks ((native):0)
  ignite (spell.js:441)
  init (collection.js:13)
  dispatch (collection.js:81)
  instantiate (bone.js:1282)
  cloneValue (bone.js:112)
  structuredClone (js_transferable:112)
```

### Path 10 (232 hits)

```
  processTicksAndRejections (task_queues:72)
  runMicrotasks ((native):0)
  ignite (spell.js:441)
  init (collection.js:13)
  dispatch (collection.js:81)
  instantiate (bone.js:1282)
```


