====================================================================================================
Performance Hotspots (filtered by: tegg)
====================================================================================================

Total Active CPU Time: 42437 samples


--- Hotspot #1 ---
Function: injectProperty
Self Time: 368 samples (0.87%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/impl/EggObjectImpl.js:165
Call Stack (bottom-up):
  1. (anonymous) [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:40]
  2. runMicrotasks [(native)]
  3. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #2 ---
Function: initWithInjectProperty
Self Time: 300 samples (0.71%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/impl/EggObjectImpl.js:20
Call Stack (bottom-up):
  1. runMicrotasks [(native)]
  2. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #3 ---
Function: init
Self Time: 274 samples (0.65%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/impl/ContextInitiator.js:13
Call Stack (bottom-up):
  1. getOrCreateEggObject [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:28]
  2. runMicrotasks [(native)]
  3. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #4 ---
Function: getOrCreateEggObject
Self Time: 188 samples (0.44%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/factory/EggContainerFactory.js:28
Call Stack (bottom-up):
  1. runMicrotasks [(native)]
  2. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #5 ---
Function: destroy
Self Time: 96 samples (0.23%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/model/AbstractEggContext.js:22
Call Stack (bottom-up):
  1. runMicrotasks [(native)]
  2. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #6 ---
Function: ctxLifecycleMiddleware
Self Time: 88 samples (0.21%)
Location: @eggjs_tegg-plugin@4.0.0-beta.34@@eggjs/tegg-plugin/dist/lib/ctx_lifecycle_middleware.js:3
Call Stack (bottom-up):
  1. dispatch [koa-compose@4.1.0@koa-compose:35]
  2. teggRootProto [@eggjs_controller-plugin@4.0.0-beta.34@@eggjs/controller-plugin:3]
  3. dispatch [koa-compose@4.1.0@koa-compose:35]
  4. dispatch [koa-compose@4.1.0@koa-compose:35]
  5. dta [@eggjs_security@5.0.0-beta.34@@eggjs/security:4]

--- Hotspot #7 ---
Function: teggRootProto
Self Time: 83 samples (0.20%)
Location: @eggjs_controller-plugin@4.0.0-beta.34@@eggjs/controller-plugin/dist/app/middleware/tegg_root_proto.js:3
Call Stack (bottom-up):
  1. dispatch [koa-compose@4.1.0@koa-compose:35]
  2. dispatch [koa-compose@4.1.0@koa-compose:35]
  3. dta [@eggjs_security@5.0.0-beta.34@@eggjs/security:4]
  4. dispatch [koa-compose@4.1.0@koa-compose:35]
  5. xframe [@eggjs_security@5.0.0-beta.34@@eggjs/security:3]

--- Hotspot #8 ---
Function: EggContextImpl
Self Time: 78 samples (0.18%)
Location: @eggjs_tegg-plugin@4.0.0-beta.34@@eggjs/tegg-plugin/dist/lib/EggContextImpl.js:7
Call Stack (bottom-up):
  1. ctxLifecycleMiddleware [@eggjs_tegg-plugin@4.0.0-beta.34@@eggjs/tegg-plugin:3]
  2. dispatch [koa-compose@4.1.0@koa-compose:35]
  3. teggRootProto [@eggjs_controller-plugin@4.0.0-beta.34@@eggjs/controller-plugin:3]
  4. dispatch [koa-compose@4.1.0@koa-compose:35]
  5. dispatch [koa-compose@4.1.0@koa-compose:35]

--- Hotspot #9 ---
Function: getOrCreateEggObject
Self Time: 74 samples (0.17%)
Location: @eggjs_tegg-plugin@4.0.0-beta.34@@eggjs/tegg-plugin/dist/lib/AppLoadUnitInstance.js:51
Call Stack (bottom-up):
  1. getOrCreateEggObject [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:28]
  2. (anonymous) [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:40]
  3. initWithInjectProperty [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:20]
  4. runMicrotasks [(native)]
  5. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #10 ---
Function: createObject
Self Time: 68 samples (0.16%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/factory/EggObjectFactory.js:17
Call Stack (bottom-up):
  1. runMicrotasks [(native)]
  2. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #11 ---
Function: getOrCreateEggObject
Self Time: 66 samples (0.16%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/model/AbstractEggContext.js:51
Call Stack (bottom-up):
  1. runMicrotasks [(native)]
  2. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #12 ---
Function: ctxLifecycleMiddleware
Self Time: 64 samples (0.15%)
Location: @eggjs_tegg-plugin@4.0.0-beta.34@@eggjs/tegg-plugin/dist/lib/ctx_lifecycle_middleware.js:3
Call Stack (bottom-up):
  1. runMicrotasks [(native)]
  2. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #13 ---
Function: getOrCreateEggObject
Self Time: 64 samples (0.15%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/factory/EggContainerFactory.js:28
Call Stack (bottom-up):
  1. (anonymous) [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:40]
  2. initWithInjectProperty [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:20]
  3. runMicrotasks [(native)]
  4. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #14 ---
Function: getLoadUnitInstance
Self Time: 64 samples (0.15%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/factory/LoadUnitInstanceFactory.js:32
Call Stack (bottom-up):
  1. createObject [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:17]
  2. getOrCreateEggObject [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:51]
  3. getOrCreateEggObject [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:28]
  4. (anonymous) [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:19]
  5. init [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:13]

--- Hotspot #15 ---
Function: destroyObject
Self Time: 63 samples (0.15%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/factory/EggObjectFactory.js:33
Call Stack (bottom-up):
  1. (anonymous) [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:31]
  2. destroy [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:22]
  3. runMicrotasks [(native)]
  4. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #16 ---
Function: (anonymous)
Self Time: 59 samples (0.14%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/impl/EggObjectImpl.js:40
Call Stack (bottom-up):
  1. initWithInjectProperty [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:20]
  2. runMicrotasks [(native)]
  3. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #17 ---
Function: (anonymous)
Self Time: 57 samples (0.13%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/factory/LoadUnitInstanceFactory.js:54
Call Stack (bottom-up):
  1. getContainer [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:16]
  2. getOrCreateEggObject [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:28]
  3. (anonymous) [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:40]
  4. initWithInjectProperty [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:20]
  5. runMicrotasks [(native)]

--- Hotspot #18 ---
Function: preCreate
Self Time: 52 samples (0.12%)
Location: @eggjs_tegg-plugin@4.0.0-beta.34@@eggjs/tegg-plugin/dist/lib/EggContextCompatibleHook.js:20
Call Stack (bottom-up):
  1. callPreCreate [@eggjs_lifecycle@4.0.0-beta.34@@eggjs/lifecycle:50]
  2. (anonymous) [@eggjs_lifecycle@4.0.0-beta.34@@eggjs/lifecycle:35]
  3. objectPreCreate [@eggjs_lifecycle@4.0.0-beta.34@@eggjs/lifecycle:32]
  4. init [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:71]
  5. ctxLifecycleMiddleware [@eggjs_tegg-plugin@4.0.0-beta.34@@eggjs/tegg-plugin:3]

--- Hotspot #19 ---
Function: destroy
Self Time: 49 samples (0.12%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/impl/EggObjectImpl.js:147
Call Stack (bottom-up):
  1. runMicrotasks [(native)]
  2. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #20 ---
Function: getOrCreateEggObject
Self Time: 49 samples (0.12%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/model/AbstractEggContext.js:51
Call Stack (bottom-up):
  1. getOrCreateEggObject [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:28]
  2. (anonymous) [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:19]
  3. init [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:13]
  4. getOrCreateEggObject [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:28]
  5. runMicrotasks [(native)]

--- Hotspot #21 ---
Function: getOrCreateEggObject
Self Time: 45 samples (0.11%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/impl/ModuleLoadUnitInstance.js:56
Call Stack (bottom-up):
  1. getOrCreateEggObject [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:28]
  2. (anonymous) [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:40]
  3. initWithInjectProperty [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:20]
  4. runMicrotasks [(native)]
  5. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #22 ---
Function: getOrCreateEggObject
Self Time: 45 samples (0.11%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/factory/EggContainerFactory.js:28
Call Stack (bottom-up):
  1. (anonymous) [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:19]
  2. init [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:13]
  3. getOrCreateEggObject [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:28]
  4. runMicrotasks [(native)]
  5. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #23 ---
Function: containPrototype
Self Time: 44 samples (0.10%)
Location: @eggjs_tegg-plugin@4.0.0-beta.34@@eggjs/tegg-plugin/dist/lib/AppLoadUnit.js:50
Call Stack (bottom-up):
  1. getLoadUnitInstanceByProto [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:45]
  2. (anonymous) [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:54]
  3. getContainer [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:16]
  4. getOrCreateEggObject [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:28]
  5. (anonymous) [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:40]

--- Hotspot #24 ---
Function: (anonymous)
Self Time: 42 samples (0.10%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/impl/EggObjectImpl.js:40
Call Stack (bottom-up):
  1. runMicrotasks [(native)]
  2. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #25 ---
Function: (anonymous)
Self Time: 38 samples (0.09%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/impl/ContextInitiator.js:19
Call Stack (bottom-up):
  1. init [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:13]
  2. getOrCreateEggObject [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:28]
  3. runMicrotasks [(native)]
  4. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #26 ---
Function: createObject
Self Time: 37 samples (0.09%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/factory/EggObjectFactory.js:17
Call Stack (bottom-up):
  1. getOrCreateEggObject [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:51]
  2. getOrCreateEggObject [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:28]
  3. (anonymous) [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:19]
  4. init [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:13]
  5. getOrCreateEggObject [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:28]

--- Hotspot #27 ---
Function: getLoadUnitInstance
Self Time: 36 samples (0.08%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/factory/LoadUnitInstanceFactory.js:32
Call Stack (bottom-up):
  1. createObject [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:17]
  2. getOrCreateEggObject [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:51]
  3. getOrCreateEggObject [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:28]
  4. preCreate [@eggjs_tegg-plugin@4.0.0-beta.34@@eggjs/tegg-plugin:20]
  5. callPreCreate [@eggjs_lifecycle@4.0.0-beta.34@@eggjs/lifecycle:50]

--- Hotspot #28 ---
Function: getOrCreateEggObject
Self Time: 35 samples (0.08%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/factory/EggContainerFactory.js:28
Call Stack (bottom-up):
  1. preCreate [@eggjs_tegg-plugin@4.0.0-beta.34@@eggjs/tegg-plugin:20]
  2. callPreCreate [@eggjs_lifecycle@4.0.0-beta.34@@eggjs/lifecycle:50]
  3. (anonymous) [@eggjs_lifecycle@4.0.0-beta.34@@eggjs/lifecycle:35]
  4. objectPreCreate [@eggjs_lifecycle@4.0.0-beta.34@@eggjs/lifecycle:32]
  5. init [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:71]

--- Hotspot #29 ---
Function: getContextProto
Self Time: 34 samples (0.08%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/impl/ContextObjectGraph.js:19
Call Stack (bottom-up):
  1. init [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:13]
  2. getOrCreateEggObject [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:28]
  3. runMicrotasks [(native)]
  4. processTicksAndRejections [node:internal/process/task_queues:72]

--- Hotspot #30 ---
Function: init
Self Time: 33 samples (0.08%)
Location: @eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime/dist/impl/EggObjectImpl.js:139
Call Stack (bottom-up):
  1. createObject [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:174]
  2. createObject [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:17]
  3. getOrCreateEggObject [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:51]
  4. getOrCreateEggObject [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:28]
  5. (anonymous) [@eggjs_tegg-runtime@4.0.0-beta.34@@eggjs/tegg-runtime:19]

====================================================================================================
