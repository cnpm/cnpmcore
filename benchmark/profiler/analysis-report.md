====================================================================================================
CPU Profile Analysis Report
====================================================================================================

## Profile Information

- Profile Type: xprofiler-cpu-profile
- Title: xprofiler
- Total Nodes: 3820
- Duration: 180.02 seconds
- Sample Count: 167448

## CPU Time Distribution

- Total Samples: 167697
- Idle Time: 151070 (90.09%)
- Program Time: 1641 (0.98%)
- GC Time: 4888 (2.91%)
- Active/User Time: 10098 (6.02%)

## Top 30 Functions by Self Time

| Rank | Hits | % of Active | Function | Location |
|------|------|-------------|----------|----------|
| 1 | 1553 | 15.38% | Bone | _leoric@2.13.9@leoric/lib/bone.js:150 |
| 2 | 595 | 5.89% | writev | (native):0 |
| 3 | 401 | 3.97% | writev | (native):0 |
| 4 | 373 | 3.69% | writeBuffer | (native):0 |
| 5 | 242 | 2.40% | nextTick | node:internal/process/task_queues:111 |
| 6 | 159 | 1.57% | read | (native):0 |
| 7 | 145 | 1.44% | onStreamRead | node:internal/stream_base_commons:166 |
| 8 | 132 | 1.31% | Bone | _leoric@2.13.9@leoric/lib/bone.js:150 |
| 9 | 118 | 1.17% | processTicksAndRejections | node:internal/process/task_queues:71 |
| 10 | 116 | 1.15% | structuredClone | (native):0 |
| 11 | 115 | 1.14% | execute | node:internal/deps/undici/undici:6712 |
| 12 | 111 | 1.10% | FastBuffer | node:internal/buffer:963 |
| 13 | 102 | 1.01% | runMicrotasks | (native):0 |
| 14 | 93 | 0.92% | nextTick | node:internal/process/task_queues:111 |
| 15 | 82 | 0.81% | structuredClone | node:internal/worker/js_transferable:112 |
| 16 | 74 | 0.73% | dispatch | _leoric@2.13.9@leoric/lib/collection.js:81 |
| 17 | 68 | 0.67% | FSReqCallback | (native):0 |
| 18 | 66 | 0.65% | crc32 | (native):0 |
| 19 | 65 | 0.64% | instantiate | _leoric@2.13.9@leoric/lib/bone.js:1282 |
| 20 | 64 | 0.63% | writeBuffer | (native):0 |
| 21 | 64 | 0.63% | fromList | node:internal/streams/readable:1585 |
| 22 | 60 | 0.59% | Readable.read | node:internal/streams/readable:645 |
| 23 | 58 | 0.57% | crc32 | (native):0 |
| 24 | 56 | 0.55% | get | lib/packets/column_definition.js:263 |
| 25 | 53 | 0.52% | nextTick | node:internal/process/task_queues:111 |
| 26 | 50 | 0.50% | write | node:fs:810 |
| 27 | 49 | 0.49% | start | lib/commands/query.js:48 |
| 28 | 45 | 0.45% |  | node:internal/deps/undici/undici:6602 |
| 29 | 44 | 0.44% | nextTick | node:internal/process/task_queues:111 |
| 30 | 41 | 0.41% | writev | (native):0 |

## Top 30 Files/Modules by CPU Time

| Rank | Hits | % of Active | File/Module | Function Count |
|------|------|-------------|-------------|----------------|
| 1 | 2975 | 29.46% | (native) | 49 |
| 2 | 2432 | 24.08% | node_modules/leoric@2.13.9@leoric | 66 |
| 3 | 660 | 6.54% | node:internal/process/task_queues | 4 |
| 4 | 345 | 3.42% | node:internal/deps/undici/undici | 39 |
| 5 | 339 | 3.36% | node:internal/streams/readable | 22 |
| 6 | 275 | 2.72% | node_modules/mysql2@3.15.3@mysql2 | 32 |
| 7 | 228 | 2.26% | node:internal/stream_base_commons | 6 |
| 8 | 189 | 1.87% | node:net | 21 |
| 9 | 165 | 1.63% | node:internal/buffer | 2 |
| 10 | 121 | 1.20% | node:internal/streams/writable | 15 |
| 11 | 112 | 1.11% | node:events | 6 |
| 12 | 108 | 1.07% | node_modules/@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime | 15 |
| 13 | 99 | 0.98% | node:fs | 4 |
| 14 | 98 | 0.97% | node_modules/is-string@1.1.1@is-string | 1 |
| 15 | 92 | 0.91% | node_modules/urllib@4.8.2@urllib | 8 |
| 16 | 86 | 0.85% | node:internal/worker/js_transferable | 1 |
| 17 | 86 | 0.85% | node_modules/undici@7.16.0@undici | 16 |
| 18 | 72 | 0.71% | node:internal/fs/streams | 6 |
| 19 | 68 | 0.67% | node_modules/is-number-object@1.1.1@is-number-object | 1 |
| 20 | 59 | 0.58% | node_modules/reflect-metadata@0.2.2@reflect-metadata | 6 |
| 21 | 56 | 0.55% | node_modules/is-bigint@1.1.0@is-bigint | 1 |
| 22 | 55 | 0.54% | node:buffer | 7 |
| 23 | 51 | 0.51% | node_modules/is-boolean-object@1.2.2@is-boolean-object | 1 |
| 24 | 51 | 0.51% | node_modules/is-array-buffer@3.0.5@is-array-buffer | 1 |
| 25 | 45 | 0.45% | wasm://wasm/00034eea | 2 |
| 26 | 43 | 0.43% | node_modules/@eggjs_koa@3.1.0-beta.34@@eggjs/koa | 13 |
| 27 | 42 | 0.42% | node_modules/egg-logger@3.6.1@egg-logger | 8 |
| 28 | 38 | 0.38% | node_modules/egg@4.1.0-beta.34@egg | 13 |
| 29 | 38 | 0.38% | app/repository/util/ModelConvertor.js | 3 |
| 30 | 37 | 0.37% | node_modules/is-shared-array-buffer@1.0.4@is-shared-array-buffer | 1 |

## CPU Time by Category

| Category | Hits | % of Active |
|----------|------|-------------|
| NPM Packages | 4085 | 40.45% |
| Native/V8 | 2975 | 29.46% |
| Node.js Core | 2818 | 27.91% |
| Application Code | 220 | 2.18% |

## Application Code Hotspots

| Rank | Hits | % | Function | File | Line |
|------|------|---|----------|------|------|
| 1 | 22 | 0.22% | syncPackage | app/core/service/PackageSearchService.js | 16 |
| 2 | 9 | 0.09% | convertModelToEntity | app/repository/util/ModelConvertor.js | 74 |
| 3 | 7 | 0.07% | syncPackageWithPackument | app/core/service/PackageSyncerService.js | 926 |
| 4 | 7 | 0.07% | syncPackageWithPackument | app/core/service/PackageSyncerService.js | 926 |
| 5 | 5 | 0.05% | convertModelToEntity | app/repository/util/ModelConvertor.js | 74 |
| 6 | 5 | 0.05% | findBinary | app/repository/BinaryRepository.js | 27 |
| 7 | 5 | 0.05% | convertModelToEntity | app/repository/util/ModelConvertor.js | 74 |
| 8 | 4 | 0.04% | getChangesStreamUrl | app/common/adapter/changesStream/AbstractChangesStream.js | 13 |
| 9 | 4 | 0.04% | convertModelToEntity | app/repository/util/ModelConvertor.js | 74 |
| 10 | 4 | 0.04% | listBinaries | app/repository/BinaryRepository.js | 33 |
| 11 | 4 | 0.04% | convertEntityToModel | app/repository/util/ModelConvertor.js | 8 |
| 12 | 4 | 0.04% | readDistBytesToJSON | app/repository/DistRepository.js | 56 |
| 13 | 3 | 0.03% | fetchChanges | app/common/adapter/changesStream/NpmChangesStream.js | 29 |
| 14 | 3 | 0.03% | syncDir | app/core/service/BinarySyncerService.js | 137 |
| 15 | 3 | 0.03% | convertModelToEntity | app/repository/util/ModelConvertor.js | 74 |
| 16 | 3 | 0.03% | executeTask | app/core/service/ChangesStreamService.js | 58 |
| 17 | 2 | 0.02% | showBinary | app/port/controller/BinarySyncController.js | 38 |
| 18 | 2 | 0.02% | findBinary | app/repository/BinaryRepository.js | 27 |
| 19 | 2 | 0.02% | saveEntityToModel | app/repository/util/ModelConvertor.js | 50 |
| 20 | 2 | 0.02% | executeSync | app/core/service/ChangesStreamService.js | 144 |

## NPM Package Hotspots

| Rank | Hits | % | Function | Package | Line |
|------|------|---|----------|---------|------|
| 1 | 1553 | 15.38% | Bone | leoric@2.13.9@leoric | 150 |
| 2 | 132 | 1.31% | Bone | leoric@2.13.9@leoric | 150 |
| 3 | 74 | 0.73% | dispatch | leoric@2.13.9@leoric | 81 |
| 4 | 65 | 0.64% | instantiate | leoric@2.13.9@leoric | 1282 |
| 5 | 56 | 0.55% | get | mysql2@3.15.3@mysql2 | 263 |
| 6 | 49 | 0.49% | start | mysql2@3.15.3@mysql2 | 48 |
| 7 | 39 | 0.39% | tryStringObject | is-string@1.1.1@is-string | 9 |
| 8 | 31 | 0.31% | parseJSON | urllib@4.8.2@urllib | 25 |
| 9 | 30 | 0.30% | keyFromFields | mysql2@3.15.3@mysql2 | 9 |
| 10 | 29 | 0.29% | isArrayBuffer | is-array-buffer@3.0.5@is-array-buffer | 18 |
| 11 | 29 | 0.29% | tryStringObject | is-string@1.1.1@is-string | 9 |
| 12 | 28 | 0.28% | _setRaw | leoric@2.13.9@leoric | 300 |
| 13 | 26 | 0.26% | tryNumberObject | is-number-object@1.1.1@is-number-object | 8 |
| 14 | 25 | 0.25% | Bone | leoric@2.13.9@leoric | 150 |
| 15 | 24 | 0.24% | query | leoric@2.13.9@leoric | 70 |
| 16 | 22 | 0.22% | ignite | leoric@2.13.9@leoric | 441 |
| 17 | 21 | 0.21% | booleanBrandCheck | is-boolean-object@1.2.2@is-boolean-object | 8 |
| 18 | 21 | 0.21% | parseHeaders | undici@7.16.0@undici | 420 |
| 19 | 19 | 0.19% | tryNumberObject | is-number-object@1.1.1@is-number-object | 8 |
| 20 | 18 | 0.18% | injectProperty | @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime | 165 |

## Top Entry Points by Total Time

| Rank | Total | % | Self | Function | Location |
|------|-------|---|------|----------|----------|
| 1 | 7377 | 73.05% | 118 | processTicksAndRejections | node:internal/process/task_queues:71 |
| 2 | 1278 | 12.66% | 15 | wrapper | node:fs:668 |
| 3 | 891 | 8.82% | 145 | onStreamRead | node:internal/stream_base_commons:166 |
| 4 | 144 | 1.43% | 13 | wrapper | node:fs:811 |
| 5 | 96 | 0.95% | 5 | parserOnHeadersComplete | node:_http_common:75 |
| 6 | 61 | 0.60% | 7 | onWriteComplete | node:internal/stream_base_commons:81 |
| 7 | 42 | 0.42% | 7 | processTimers | node:internal/timers:526 |
| 8 | 39 | 0.39% | 5 | channel.onread | node:internal/child_process:613 |
| 9 | 30 | 0.30% | 0 | ssl.onhandshakedone | node:_tls_wrap:861 |
| 10 | 19 | 0.19% | 1 | processImmediate | node:internal/timers:456 |
| 11 | 17 | 0.17% | 1 | wrapper | node:fs:940 |
| 12 | 16 | 0.16% | 0 | handleRequest | dist/application.js:168 |
| 13 | 13 | 0.13% | 0 | afterConnectMultiple | node:net:1691 |
| 14 | 9 | 0.09% | 4 | serverStatus | middleware/status.js:23 |
| 15 | 8 | 0.08% | 0 | then | lib/spell.js:458 |

====================================================================================================
End of Report
====================================================================================================
