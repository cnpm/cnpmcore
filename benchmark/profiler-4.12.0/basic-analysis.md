====================================================================================================
CPU Profile Analysis Report
====================================================================================================

## Profile Information

- Profile Type: xprofiler-cpu-profile
- Title: xprofiler
- Total Nodes: 5810
- Duration: 180.02 seconds
- Sample Count: 163745

## CPU Time Distribution

- Total Samples: 164488
- Idle Time: 117123 (71.20%)
- Program Time: 2289 (1.39%)
- GC Time: 2639 (1.60%)
- Active/User Time: 42437 (25.80%)

## Top 30 Functions by Self Time

| Rank | Hits | % of Active | Function | Location |
|------|------|-------------|----------|----------|
| 1 | 3017 | 7.11% | Bone | _leoric@2.13.9@leoric/lib/bone.js:150 |
| 2 | 1561 | 3.68% | runMicrotasks | (native):0 |
| 3 | 1081 | 2.55% | structuredClone | (native):0 |
| 4 | 762 | 1.80% | writev | (native):0 |
| 5 | 617 | 1.45% | structuredClone | node:internal/worker/js_transferable:112 |
| 6 | 595 | 1.40% | match | router/dist/Layer.js:72 |
| 7 | 564 | 1.33% | dispatch | _leoric@2.13.9@leoric/lib/collection.js:81 |
| 8 | 556 | 1.31% | _addHeaderLine | node:_http_incoming:382 |
| 9 | 477 | 1.12% |  | router/dist/Router.js:137 |
| 10 | 381 | 0.90% | instantiate | _leoric@2.13.9@leoric/lib/bone.js:1282 |
| 11 | 381 | 0.90% | get | lib/packets/column_definition.js:263 |
| 12 | 368 | 0.87% | injectProperty | dist/impl/EggObjectImpl.js:165 |
| 13 | 346 | 0.82% | readDistBytesToJSON | app/repository/DistRepository.js:31 |
| 14 | 334 | 0.79% | start | lib/commands/query.js:48 |
| 15 | 321 | 0.76% |  | impl/http/HTTPMethodRegister.js:160 |
| 16 | 300 | 0.71% | initWithInjectProperty | dist/impl/EggObjectImpl.js:20 |
| 17 | 288 | 0.68% | writeBuffer | (native):0 |
| 18 | 274 | 0.65% | init | dist/impl/ContextInitiator.js:13 |
| 19 | 259 | 0.61% | parseChannelMessages | node:internal/child_process/serialization:142 |
| 20 | 257 | 0.61% | writeUtf8String | (native):0 |
| 21 | 249 | 0.59% | close | (native):0 |
| 22 | 226 | 0.53% | processTicksAndRejections | node:internal/process/task_queues:72 |
| 23 | 215 | 0.51% | _setRaw | _leoric@2.13.9@leoric/lib/bone.js:300 |
| 24 | 202 | 0.48% | createCallContext | aop-runtime/dist/AspectExecutor.js:20 |
| 25 | 198 | 0.47% |  | impl/http/HTTPMethodRegister.js:36 |
| 26 | 195 | 0.46% | convertModelToEntity | repository/util/ModelConvertor.js:74 |
| 27 | 191 | 0.45% | show | controller/package/ShowPackageController.js:20 |
| 28 | 188 | 0.44% | getOrCreateEggObject | dist/factory/EggContainerFactory.js:28 |
| 29 | 173 | 0.41% | _setRawSaved | _leoric@2.13.9@leoric/lib/bone.js:314 |
| 30 | 168 | 0.40% | promiseAfterHook | node:internal/async_hooks:353 |

## Top 30 Files/Modules by CPU Time

| Rank | Hits | % of Active | File/Module | Function Count |
|------|------|-------------|-------------|----------------|
| 1 | 6993 | 16.48% | node_modules/leoric@2.13.9@leoric | 75 |
| 2 | 6409 | 15.10% | (native) | 47 |
| 3 | 2753 | 6.49% | node_modules/@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime | 18 |
| 4 | 2398 | 5.65% | node:internal/async_hooks | 16 |
| 5 | 2175 | 5.13% | node_modules/mysql2@3.15.3@mysql2 | 39 |
| 6 | 1359 | 3.20% | node_modules/@eggjs_router@4.0.0-beta.34@@eggjs/router | 6 |
| 7 | 1155 | 2.72% | node:internal/process/task_queues | 5 |
| 8 | 1147 | 2.70% | node_modules/@eggjs_lifecycle@4.0.0-beta.34@@eggjs/lifecycle | 12 |
| 9 | 860 | 2.03% | node_modules/reflect-metadata@0.2.2@reflect-metadata | 8 |
| 10 | 812 | 1.91% | node_modules/egg-logger@3.6.1@egg-logger | 10 |
| 11 | 806 | 1.90% | node_modules/@eggjs_koa@3.1.0-beta.34@@eggjs/koa | 21 |
| 12 | 792 | 1.87% | node:net | 28 |
| 13 | 783 | 1.85% | node:_http_incoming | 8 |
| 14 | 669 | 1.58% | node_modules/@eggjs_controller-plugin@4.0.0-beta.34@@eggjs/controller-plugin | 3 |
| 15 | 648 | 1.53% | node_modules/@eggjs_aop-runtime@4.0.0-beta.34@@eggjs/aop-runtime | 10 |
| 16 | 620 | 1.46% | node:internal/worker/js_transferable | 2 |
| 17 | 537 | 1.27% | node_modules/@eggjs_tegg-plugin@4.0.0-beta.34@@eggjs/tegg-plugin | 12 |
| 18 | 534 | 1.26% | node:_http_server | 17 |
| 19 | 470 | 1.11% | node:events | 12 |
| 20 | 413 | 0.97% | node_modules/egg@4.1.0-beta.34@egg | 17 |
| 21 | 403 | 0.95% | node:internal/streams/readable | 21 |
| 22 | 381 | 0.90% | node:_http_outgoing | 17 |
| 23 | 375 | 0.88% | node:internal/child_process/serialization | 2 |
| 24 | 347 | 0.82% | app/repository/DistRepository.js | 2 |
| 25 | 345 | 0.81% | node:internal/async_local_storage/async_hooks | 2 |
| 26 | 341 | 0.80% | node:buffer | 12 |
| 27 | 338 | 0.80% | node_modules/koa-compose@4.1.0@koa-compose | 3 |
| 28 | 333 | 0.78% | node:internal/streams/writable | 20 |
| 29 | 317 | 0.75% | app/core/service/PackageManagerService.js | 5 |
| 30 | 284 | 0.67% | node_modules/utility@2.5.0@utility | 5 |

## CPU Time by Category

| Category | Hits | % of Active |
|----------|------|-------------|
| NPM Packages | 23206 | 54.68% |
| Node.js Core | 10877 | 25.63% |
| Native/V8 | 6409 | 15.10% |
| Application Code | 1945 | 4.58% |

## Application Code Hotspots

| Rank | Hits | % | Function | File | Line |
|------|------|---|----------|------|------|
| 1 | 346 | 0.82% | readDistBytesToJSON | app/repository/DistRepository.js | 31 |
| 2 | 195 | 0.46% | convertModelToEntity | app/repository/util/ModelConvertor.js | 74 |
| 3 | 191 | 0.45% | show | app/port/controller/package/ShowPackageController.js | 20 |
| 4 | 129 | 0.30% | _listPackageFullOrAbbreviatedManifests | app/core/service/PackageManagerService.js | 806 |
| 5 | 116 | 0.27% | plusPackageVersionCounter | app/core/service/PackageManagerService.js | 407 |
| 6 | 90 | 0.21% | syncPackage | app/core/service/PackageSearchService.js | 16 |
| 7 | 71 | 0.17% |  | app/repository/BinaryRepository.js | 47 |
| 8 | 69 | 0.16% | beforeCall | app/common/aop/AsyncTimer.js | 17 |
| 9 | 61 | 0.14% | afterFinally | app/common/aop/AsyncTimer.js | 24 |
| 10 | 52 | 0.12% | Tracing | app/port/middleware/Tracing.js | 1 |
| 11 | 48 | 0.11% | download | app/port/controller/package/DownloadPackageVersionTar.js | 26 |
| 12 | 43 | 0.10% | listBinaries | app/repository/BinaryRepository.js | 33 |
| 13 | 40 | 0.09% | diff | app/core/service/BinarySyncerService.js | 226 |
| 14 | 30 | 0.07% | download | app/port/controller/package/DownloadPackageVersionTar.js | 26 |
| 15 | 30 | 0.07% | savePackageVersionCounters | app/core/service/PackageManagerService.js | 428 |
| 16 | 25 | 0.06% | getAndCheckVersionFromFilename | app/port/controller/AbstractController.js | 132 |
| 17 | 25 | 0.06% | plus | app/repository/PackageVersionDownloadRepository.js | 13 |
| 18 | 20 | 0.05% | plus | app/repository/PackageVersionDownloadRepository.js | 13 |
| 19 | 19 | 0.04% | getDownloadUrl | app/common/adapter/NFSAdapter.js | 51 |
| 20 | 19 | 0.04% | AlwaysAuth | app/port/middleware/AlwaysAuth.js | 2 |

## NPM Package Hotspots

| Rank | Hits | % | Function | Package | Line |
|------|------|---|----------|---------|------|
| 1 | 3017 | 7.11% | Bone | leoric@2.13.9@leoric | 150 |
| 2 | 595 | 1.40% | match | @eggjs_router@4.0.0-beta.34@@eggjs/router | 72 |
| 3 | 564 | 1.33% | dispatch | leoric@2.13.9@leoric | 81 |
| 4 | 477 | 1.12% |  | @eggjs_router@4.0.0-beta.34@@eggjs/router | 137 |
| 5 | 381 | 0.90% | instantiate | leoric@2.13.9@leoric | 1282 |
| 6 | 381 | 0.90% | get | mysql2@3.15.3@mysql2 | 263 |
| 7 | 368 | 0.87% | injectProperty | @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime | 165 |
| 8 | 334 | 0.79% | start | mysql2@3.15.3@mysql2 | 48 |
| 9 | 321 | 0.76% |  | @eggjs_controller-plugin@4.0.0-beta.34@@eggjs/controller-plugin | 160 |
| 10 | 300 | 0.71% | initWithInjectProperty | @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime | 20 |
| 11 | 274 | 0.65% | init | @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime | 13 |
| 12 | 215 | 0.51% | _setRaw | leoric@2.13.9@leoric | 300 |
| 13 | 202 | 0.48% | createCallContext | @eggjs_aop-runtime@4.0.0-beta.34@@eggjs/aop-runtime | 20 |
| 14 | 198 | 0.47% |  | @eggjs_controller-plugin@4.0.0-beta.34@@eggjs/controller-plugin | 36 |
| 15 | 188 | 0.44% | getOrCreateEggObject | @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime | 28 |
| 16 | 173 | 0.41% | _setRawSaved | leoric@2.13.9@leoric | 314 |
| 17 | 167 | 0.39% | keyFromFields | mysql2@3.15.3@mysql2 | 9 |
| 18 | 138 | 0.33% | query | leoric@2.13.9@leoric | 70 |
| 19 | 137 | 0.32% | dispatch | @eggjs_router@4.0.0-beta.34@@eggjs/router | 122 |
| 20 | 134 | 0.32% |  | leoric@2.13.9@leoric | 98 |

## Top Entry Points by Total Time

| Rank | Total | % | Self | Function | Location |
|------|-------|---|------|----------|----------|
| 1 | 36311 | 85.56% | 226 | processTicksAndRejections | node:internal/process/task_queues:72 |
| 2 | 3761 | 8.86% | 99 | callbackTrampoline | node:internal/async_hooks:118 |
| 3 | 1977 | 4.66% | 55 | parserOnHeadersComplete | node:_http_common:74 |
| 4 | 130 | 0.31% | 27 | processTimers | node:internal/timers:508 |
| 5 | 92 | 0.22% | 4 | parserOnMessageComplete | node:_http_common:140 |
| 6 | 69 | 0.16% | 41 | emitInitNative | node:internal/async_hooks:192 |
| 7 | 15 | 0.04% | 0 | handleRequest | dist/application.js:168 |
| 8 | 8 | 0.02% | 8 | emit | node:internal/child_process:947 |
| 9 | 7 | 0.02% | 7 | channel.onread | node:internal/child_process:613 |
| 10 | 7 | 0.02% | 7 | processPromiseRejections | node:internal/process/promises:439 |
| 11 | 6 | 0.01% | 6 | resume_ | node:internal/streams/readable:1254 |
| 12 | 5 | 0.01% | 1 | connect | node:internal/deps/undici/undici:7976 |
| 13 | 5 | 0.01% | 2 | serverStatus | middleware/status.js:23 |
| 14 | 4 | 0.01% | 4 | onStreamRead | node:internal/stream_base_commons:166 |
| 15 | 4 | 0.01% | 4 | Readable | node:internal/streams/readable:320 |

====================================================================================================
End of Report
====================================================================================================
