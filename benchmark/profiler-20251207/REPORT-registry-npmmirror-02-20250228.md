# CPU Profile Analysis Report

Generated: 2025-12-07T13:34:09.791Z

## Summary

| Metric | Value |
|--------|-------|
| Profile File | registry.npmmirror.com-02-x-cpuprofile-2645570-20250228-0.cpuprofile |
| Total Nodes | 7666 |
| Total Hits | 157965 |
| Profile Type | xprofiler-cpu-profile |

## Module Breakdown

| Module | Hits | % | Functions |
|--------|------|---|----------|
| (native/gc) | 46421 | 29.39% | 69 |
| leoric@leoric | 26362 | 16.69% | 95 |
| node:internal | 19680 | 12.46% | 207 |
| mysql2@mysql2 | 14225 | 9.01% | 53 |
| @eggjs_tegg-runtime@@eggjs | 9531 | 6.03% | 22 |
| @eggjs_tegg-lifecycle@@eggjs | 4812 | 3.05% | 15 |
| cnpmcore (app) | 3295 | 2.09% | 169 |
| egg-logger@egg-logger | 2724 | 1.72% | 10 |
| @eggjs_router@@eggjs | 2294 | 1.45% | 8 |
| node:async_hooks | 2129 | 1.35% | 8 |
| node:buffer | 1928 | 1.22% | 21 |
| node:net | 1663 | 1.05% | 32 |
| node:events | 1461 | 0.92% | 13 |
| koa@koa | 1372 | 0.87% | 24 |
| delegates@delegates | 1240 | 0.78% | 2 |
| @eggjs_tegg-plugin@@eggjs | 1198 | 0.76% | 17 |
| reflect-metadata@reflect-metadata | 1197 | 0.76% | 6 |
| node:_http_incoming | 1167 | 0.74% | 8 |
| egg@egg | 906 | 0.57% | 25 |
| utility@utility | 906 | 0.57% | 5 |

## cnpmcore Application Analysis

### Leoric (ORM)

- **Total Hits**: 26362 (16.69%)
- **Top Functions**:
  - `Bone` in /home/admin/application/node_modules/_leoric@2.13.5@leoric/lib/bone.js:142 (8838 hits)
  - `isLogicalCondition` in /home/admin/application/node_modules/_leoric@2.13.5@leoric/lib/query_object.js:102 (2203 hits)
  - `ignite` in /home/admin/application/node_modules/_leoric@2.13.5@leoric/lib/spell.js:441 (1270 hits)
  - `token` in /home/admin/application/node_modules/_leoric@2.13.5@leoric/lib/expr.js:266 (1217 hits)
  - `query` in /home/admin/application/node_modules/_leoric@2.13.5@leoric/lib/drivers/mysql/index.js:68 (1213 hits)

### MySQL Driver

- **Total Hits**: 14225 (9.01%)
- **Top Functions**:
  - `get` in /home/admin/application/node_modules/_mysql2@3.12.0@mysql2/lib/packets/column_definition.js:262 (3671 hits)
  - `keyFromFields` in /home/admin/application/node_modules/_mysql2@3.12.0@mysql2/lib/parsers/parser_cache.js:9 (2021 hits)
  - `start` in /home/admin/application/node_modules/_mysql2@3.12.0@mysql2/lib/commands/query.js:47 (1864 hits)
  - `createQuery` in /home/admin/application/node_modules/_mysql2@3.12.0@mysql2/lib/base/connection.js:909 (1664 hits)
  - `parseDateTime` in /home/admin/application/node_modules/_mysql2@3.12.0@mysql2/lib/packets/packet.js:649 (514 hits)

### HTTP/Router

- **Total Hits**: 28362 (17.95%)
- **Top Functions**:
  - `getLifecycleHook` in /home/admin/application/node_modules/_@eggjs_tegg-lifecycle@3.52.0@@eggjs/tegg-lifecycle/dist/src/LifycycleUtil.js:78 (1503 hits)
  - `initWithInjectProperty` in /home/admin/application/node_modules/_@eggjs_tegg-runtime@3.52.0@@eggjs/tegg-runtime/dist/src/impl/EggObjectImpl.js:18 (1265 hits)
  - `init` in /home/admin/application/node_modules/_@eggjs_tegg-runtime@3.52.0@@eggjs/tegg-runtime/dist/src/impl/ContextInitiator.js:14 (1115 hits)
  - `getOrCreateEggObject` in /home/admin/application/node_modules/_@eggjs_tegg-runtime@3.52.0@@eggjs/tegg-runtime/dist/src/factory/EggContainerFactory.js:25 (1085 hits)
  - `injectProperty` in /home/admin/application/node_modules/_@eggjs_tegg-runtime@3.52.0@@eggjs/tegg-runtime/dist/src/impl/EggObjectImpl.js:162 (1005 hits)

### JSON Processing

- **Total Hits**: 1917 (1.21%)
- **Top Functions**:
  - `parseChannelMessages` in node:internal/child_process/serialization:137 (447 hits)
  - `readDistBytesToJSON` in /home/admin/application/app/repository/DistRepository.js:36 (438 hits)
  - `parse` in (native):0 (381 hits)
  - `parserOnIncoming` in node:_http_server:1028 (87 hits)
  - `parseMediaType` in /home/admin/application/node_modules/_negotiator@0.6.3@negotiator/lib/mediaType.js:53 (84 hits)

### Compression

- **Total Hits**: 4 (0.00%)
- **Top Functions**:
  - `zlibBufferSync` in node:zlib:164 (1 hits)
  - `Gunzip` in node:zlib:731 (1 hits)
  - `ZlibBase` in node:zlib:204 (1 hits)
  - `ZlibBase._transform` in node:zlib:370 (1 hits)

### Validation

- **Total Hits**: 196 (0.12%)
- **Top Functions**:
  - `(anonymous)` in node:internal/validators:529 (91 hits)
  - `validate` in /home/admin/application/node_modules/_validate-npm-package-name@5.0.1@validate-npm-package-name/lib/index.js:10 (45 hits)
  - `validRange` in /home/admin/application/node_modules/_semver@7.7.1@semver/ranges/valid.js:2 (21 hits)
  - `done` in /home/admin/application/node_modules/_validate-npm-package-name@5.0.1@validate-npm-package-name/lib/index.js:89 (17 hits)
  - `validate` in /home/admin/application/node_modules/_ajv@8.17.1@ajv/dist/core.js:140 (7 hits)

### Entity/Service

- **Total Hits**: 772 (0.49%)
- **Top Functions**:
  - `_listPackageFullOrAbbreviatedManifests` in /home/admin/application/app/core/service/PackageManagerService.js:779 (217 hits)
  - `plusPackageVersionCounter` in /home/admin/application/app/core/service/PackageManagerService.js:412 (209 hits)
  - `Entity` in /home/admin/application/app/core/entity/Entity.js:5 (67 hits)
  - `findBlockInfo` in /home/admin/application/app/core/service/PackageVersionService.js:138 (56 hits)
  - `savePackageVersionCounters` in /home/admin/application/app/core/service/PackageManagerService.js:433 (47 hits)

### Controller

- **Total Hits**: 458 (0.29%)
- **Top Functions**:
  - `show` in /home/admin/application/app/port/controller/package/ShowPackageController.js:27 (229 hits)
  - `download` in /home/admin/application/app/port/controller/package/DownloadPackageVersionTar.js:35 (174 hits)
  - `raw` in /home/admin/application/app/port/controller/PackageVersionFileController.js:82 (14 hits)
  - `getAndCheckVersionFromFilename` in /home/admin/application/app/port/controller/AbstractController.js:136 (13 hits)
  - `_PackageVersionFileController_getPackageVersion` in /home/admin/application/app/port/controller/PackageVersionFileController.js:147 (10 hits)

### Other App Code

- **Total Hits**: 10735 (6.80%)
- **Top Functions**:
  - `(anonymous)` in /home/admin/application/node_modules/_delegates@1.0.0@delegates/index.js:71 (948 hits)
  - `get` in /home/admin/application/node_modules/_lru.min@1.1.1@lru.min/lib/index.js:70 (551 hits)
  - `convertModelToEntity` in /home/admin/application/app/repository/util/ModelConvertor.js:80 (535 hits)
  - `logDate` in /home/admin/application/node_modules/_utility@2.5.0@utility/dist/commonjs/date.js:83 (471 hits)
  - `GetOrCreateMetadataMap` in /home/admin/application/node_modules/_reflect-metadata@0.1.14@reflect-metadata/Reflect.js:562 (414 hits)

## Top 30 Functions by Self Time

| # | Function | Location | Hits | % |
|---|----------|----------|------|---|
| 1 | (idle) | (native):0 | 21062 | 13.33% |
| 2 | Bone | bone.js:142 | 8838 | 5.59% |
| 3 | (garbage collector) | (native):0 | 5410 | 3.42% |
| 4 | (program) | (native):0 | 5326 | 3.37% |
| 5 | runMicrotasks | (native):0 | 5303 | 3.36% |
| 6 | promiseInitHook | async_hooks:320 | 4183 | 2.65% |
| 7 | get | column_definition.js:262 | 3671 | 2.32% |
| 8 | lookupPublicResource | async_hooks:177 | 2713 | 1.72% |
| 9 | isLogicalCondition | query_object.js:102 | 2203 | 1.39% |
| 10 | writeBuffer | (native):0 | 2143 | 1.36% |
| 11 | nextTick | task_queues:103 | 2080 | 1.32% |
| 12 | _propagate | node:async_hooks:319 | 2036 | 1.29% |
| 13 | keyFromFields | parser_cache.js:9 | 2021 | 1.28% |
| 14 | start | query.js:47 | 1864 | 1.18% |
| 15 | createQuery | connection.js:909 | 1664 | 1.05% |
| 16 | writev | (native):0 | 1619 | 1.02% |
| 17 | getLifecycleHook | LifycycleUtil.js:78 | 1503 | 0.95% |
| 18 | writeUtf8String | (native):0 | 1281 | 0.81% |
| 19 | ignite | spell.js:441 | 1270 | 0.80% |
| 20 | initWithInjectProperty | EggObjectImpl.js:18 | 1265 | 0.80% |
| 21 | token | expr.js:266 | 1217 | 0.77% |
| 22 | query | index.js:68 | 1213 | 0.77% |
| 23 | init | ContextInitiator.js:14 | 1115 | 0.71% |
| 24 | getOrCreateEggObject | EggContainerFactory.js:25 | 1085 | 0.69% |
| 25 | injectProperty | EggObjectImpl.js:162 | 1005 | 0.64% |
| 26 | logger | debuglog:100 | 997 | 0.63% |
| 27 | dispatch | collection.js:77 | 989 | 0.63% |
| 28 | Spell | spell.js:325 | 971 | 0.61% |
| 29 | match | layer.js:76 | 960 | 0.61% |
| 30 | (anonymous) | index.js:71 | 948 | 0.60% |

## Hot Paths (Top CPU Consuming Call Stacks)

### Path 1 (21062 hits)

```
  (idle) ((native):0)
```

### Path 2 (8823 hits)

```
  processTicksAndRejections (task_queues:67)
  runMicrotasks ((native):0)
  ignite (spell.js:441)
  init (collection.js:13)
  dispatch (collection.js:77)
  instantiate (bone.js:1269)
  ContextModelClass (SingletonModelObject.js:15)
  Bone (bone.js:142)
```

### Path 3 (5410 hits)

```
  (garbage collector) ((native):0)
```

### Path 4 (5326 hits)

```
  (program) ((native):0)
```

### Path 5 (5303 hits)

```
  processTicksAndRejections (task_queues:67)
  runMicrotasks ((native):0)
```

### Path 6 (1849 hits)

```
  processTicksAndRejections (task_queues:67)
  runMicrotasks ((native):0)
  query (index.js:68)
  (anonymous) (index.js:71)
  query (connection.js:558)
  addCommand (connection.js:490)
  handlePacket (connection.js:417)
  execute (command.js:23)
  start (query.js:47)
```

### Path 7 (1642 hits)

```
  processTicksAndRejections (task_queues:67)
  runMicrotasks ((native):0)
  query (index.js:68)
  (anonymous) (index.js:71)
  query (connection.js:558)
  createQuery (connection.js:909)
```

### Path 8 (1202 hits)

```
  processTicksAndRejections (task_queues:67)
  runMicrotasks ((native):0)
  ignite (spell.js:441)
```

### Path 9 (1136 hits)

```
  processTicksAndRejections (task_queues:67)
  runMicrotasks ((native):0)
  initWithInjectProperty (EggObjectImpl.js:18)
  getLifecycleHook (LifycycleUtil.js:78)
```

### Path 10 (1105 hits)

```
  processTicksAndRejections (task_queues:67)
  runMicrotasks ((native):0)
  query (index.js:68)
```


